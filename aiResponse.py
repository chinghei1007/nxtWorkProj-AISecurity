# ai_response.py
import os
from dotenv import load_dotenv
import groq

# Load .env
load_dotenv()

_client = groq.Groq(api_key=os.getenv("GROQ_API_KEY"))

def AIResponse(message: str, system: str = "", model: str = "openai/gpt-oss-120b") -> str:
    """
    Minimal Groq wrapper.
    - message: user content
    - system: optional system instruction
    - model: Groq model name
    """

    messages = []
    if system:
        messages.append({"role": "system", "content": system})

    messages.append({"role": "user", "content": message})

    try:
        response = _client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.0
        )

        # FIX: Groq returns objects, not dicts
        return response.choices[0].message.content

    except Exception as e:
        return f"[AI ERROR] {e}"
