import os
from dotenv import load_dotenv
import google.genai as genai

load_dotenv()
api_key = os.getenv("GOOGLE_API_KEY")
client = genai.Client(api_key=api_key)

# Test with a simple prompt
try:
    response = client.models.generate_content(
        model='gemini-2.0-flash', contents='Why is the sky blue?'
    )
    print(response)
except Exception as e:
    print(f"❌ Connection failed: {e}")
