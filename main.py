import os
import requests
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# CORS sozlamalarini dinamik qilish
origins = [
    "http://localhost:3000", # Lokal development uchun
]
FRONTEND_URL = os.getenv("FRONTEND_URL")
if FRONTEND_URL:
    origins.append(FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TRAVELPAYOUTS_MARKER = os.getenv("TRAVELPAYOUTS_MARKER")
TRAVELPAYOUTS_TOKEN = os.getenv("TRAVELPAYOUTS_TOKEN")
API_BASE_URL = "https://api.travelpayouts.com/v1"

class SearchQuery(BaseModel):
    origin: str
    destination: str
    depart_date: str
    return_date: str

class RedirectQuery(BaseModel):
    search_id: str
    terms_url: str

@app.post("/api/search")
async def search_flights(query: SearchQuery, request: Request):
    user_ip = request.client.host
    host = request.headers.get("host", "localhost")
    search_payload = {
        "marker": TRAVELPAYOUTS_MARKER,
        "host": host,
        "user_ip": user_ip,
        "locale": "uz",
        "trip_class": "Y",
        "currency": "UZS",
        "passengers": {"adults": 1, "children": 0, "infants": 0},
        "segments": [
            {"origin": query.origin, "destination": query.destination, "date": query.depart_date},
            {"origin": query.destination, "destination": query.origin, "date": query.return_date},
        ]
    }

    try:
        response = requests.post(f"{API_BASE_URL}/flight_search", json=search_payload)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        return {"error": str(e), "details": e.response.text if e.response else "No response"}

@app.get("/api/results/{search_id}")
async def get_search_results(search_id: str):
    params = {'uuid': search_id}
    try:
        response = requests.get(f"{API_BASE_URL}/flight_search_results", params=params)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        return {"error": str(e)}

@app.post("/api/redirect")
async def get_redirect_link(query: RedirectQuery):
    redirect_url = f"{API_BASE_URL}/flight_searches/{query.search_id}/clicks/{query.terms_url}.json"
    params = {'marker': TRAVELPAYOUTS_MARKER}
    try:
        response = requests.get(redirect_url, params=params)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        return {"error": str(e)}

@app.get("/")
def read_root():
    return {"message": "Salom, Travelpayouts saytiga xush kelibsiz!"}
