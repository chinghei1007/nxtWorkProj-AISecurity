from aiResponse import AIResponse

result = AIResponse(
    message='Scan this code for vulnerabilities:\nimport os from dotenv import load_dotenv import google.genai as genai load_dotenv() api_key = os.getenv("GOOGLE_API_KEY") client = genai.Client(api_key=api_key) # List available models models = client.models.list() for m in models: print(m.name)',
    system="You are a strict security auditor. Output only findings."
)

print(result)
