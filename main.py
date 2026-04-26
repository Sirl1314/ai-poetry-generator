from datetime import datetime
from typing import Any
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from openai import OpenAI
import json
import os

# 创建FastAPI实例
app = FastAPI(title="AI诗词生成器")

# 数据模型
class ApiResponse(BaseModel):
    code: int
    message: str
    data: Any

class ChatRequest(BaseModel):
    session_id: str
    theme: str          # 创作主题
    poetry_type: str    # 诗词类型（唐诗/宋词）
    form: str           # 具体体裁（五言/七言/词牌名）

# 创建会话目录
if not os.path.exists("sessions"):
    os.mkdir("sessions")

# 生成会话ID
def generate_session_id():
    return datetime.now().strftime("%Y-%m-%d %H-%M-%S")

# 获取会话文件路径
def get_session_file(session_id):
    return f"sessions/{session_id}.json"

# 诗词生成系统提示词（核心）
SYSTEM_PROMPT = """
# 角色定义
你是一位精通中国古典诗词的AI创作助手，擅长创作符合格律、意境优美的唐诗和宋词，全程纯文本交互，不使用表情符号。

## 核心能力
1. 严格按照用户指定的体裁创作诗词，符合平仄/押韵基本规则
2. 主题贴合用户需求，语言典雅，避免现代词汇
3. 每首诗词附带简短解析（创作思路+意境说明）
4. 记忆会话内已生成的诗词，避免重复风格/内容

## 创作规则
### 唐诗规则
- 五言绝句：4句，每句5字，押平声韵，符合绝句格律
- 七言绝句：4句，每句7字，押平声韵，符合绝句格律
- 五言律诗：8句，每句5字，中间两联对仗，押平声韵
- 七言律诗：8句，每句7字，中间两联对仗，押平声韵

### 宋词规则
- 江城子：35字（单调），押平声韵，风格豪放/婉约均可
- 水调歌头：95字，押仄声韵，经典格律
- 蝶恋花：60字，押仄声韵，婉约风格为主
- 清平乐：46字，押仄声韵，短小精巧

## 回复格式（严格执行）
### 唐诗回复格式：
【标题】{自定义标题}
{诗词内容，每句换行}

【解析】{创作思路+意境说明，50字以内}

### 宋词回复格式：
【{词牌名}·{标题}】
{宋词内容，按阕分行}

【解析】{创作思路+意境说明，50字以内}

## 风格约束
- 语言典雅，符合古典诗词审美
- 解析简洁易懂，不堆砌术语
- 拒绝生僻字，兼顾可读性与文学性
- 回复仅包含诗词+解析，无多余闲聊内容
"""

# 初始化OpenAI客户端（兼容DeepSeek）
client = OpenAI(
    api_key=os.environ.get('DEEPSEEK_API_KEY'),  # 也可替换为OPENAI_API_KEY
    base_url="https://api.deepseek.com"  # 切换OpenAI时改为https://api.openai.com/v1
)

# 挂载静态文件
app.mount("/static", StaticFiles(directory="static"), name="static")

# 首页
@app.get("/")
def root():
    return FileResponse("./static/index.html")

# 新建会话
@app.post("/api/sessions")
def create_session():
    session_id = generate_session_id()
    session_data = {
        "current_session": session_id,
        "records": []  # 存储历史生成记录
    }
    with open(get_session_file(session_id), "w", encoding="utf-8") as f:
        json.dump(session_data, f, ensure_ascii=False, indent=2)
    return ApiResponse(code=200, message="创建成功", data=session_id)

# 生成诗词
@app.post("/api/generate")
def generate_poetry(request: ChatRequest):
    # 加载会话数据
    session_path = get_session_file(request.session_id)
    with open(session_path, "r", encoding="utf-8") as f:
        session_data = json.load(f)

    # 构建AI请求消息
    user_prompt = f"""
    请创作一首{request.poetry_type}，具体要求：
    - 主题：{request.theme}
    - 体裁：{request.form}
    """
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt}
    ]

    # 调用AI生成
    response = client.chat.completions.create(
        model="deepseek-chat",  # OpenAI替换为gpt-3.5-turbo/gpt-4
        messages=messages,
        temperature=0.8,  # 降低随机性，保证格律严谨
        stream=False
    )
    poetry_content = response.choices[0].message.content

    # 更新会话记录
    session_data["records"].append({
        "theme": request.theme,
        "type": request.poetry_type,
        "form": request.form,
        "content": poetry_content,
        "create_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    })
    with open(session_path, "w", encoding="utf-8") as f:
        json.dump(session_data, f, ensure_ascii=False, indent=2)

    return ApiResponse(code=200, message="生成成功", data=poetry_content)

# 加载会话列表
@app.get("/api/sessions")
def load_sessions():
    session_list = []
    if os.path.exists("sessions"):
        for filename in os.listdir("sessions"):
            if filename.endswith(".json"):
                session_list.append(filename[:-5])
    return ApiResponse(code=200, message="加载成功", data=session_list)

# 加载会话详情
@app.get("/api/sessions/{session_id}")
def get_session_detail(session_id: str):
    file_path = get_session_file(session_id)
    if not os.path.exists(file_path):
        return ApiResponse(code=404, message="会话不存在", data=None)
    with open(file_path, "r", encoding="utf-8") as f:
        session_data = json.load(f)
    return ApiResponse(code=200, message="加载成功", data=session_data)

# 删除会话
@app.delete("/api/sessions/{session_id}")
def delete_session(session_id: str):
    file_path = get_session_file(session_id)
    if not os.path.exists(file_path):
        return ApiResponse(code=404, message="会话不存在", data=None)
    os.remove(file_path)
    return ApiResponse(code=200, message="删除成功", data=None)

# 启动服务
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8081)