import uvicorn

from app.config import CORS_ORIGIN, PORT

if __name__ == "__main__":
    print(f"ProfConnect status API listening on http://localhost:{PORT}")
    print(f"Allowed origins: {', '.join(CORS_ORIGIN)}")
    uvicorn.run("app.main:app", host="0.0.0.0", port=PORT, reload=True)
