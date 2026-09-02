import uvicorn
import argparse
import sys
import os

# Ensure current directory is at head of Python path for Uvicorn module imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ORBITAL Engine Launcher")
    parser.add_argument("--port", type=int, default=8000, help="Port to listen on")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host address to bind to")
    args = parser.parse_args()
    
    print(f"🚀 Starting ORBITAL Python Engine on http://{args.host}:{args.port}")
    uvicorn.run("server.main:app", host=args.host, port=args.port, reload=True)
