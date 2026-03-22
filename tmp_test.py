import os
import requests
import base64
from dotenv import load_dotenv

load_dotenv("frontend/.env.local")

def test():
    token_url = "https://api.ebay.com/identity/v1/oauth2/token"
    auth_str = f"{os.environ['EBAY_CLIENT_ID']}:{os.environ['EBAY_CLIENT_SECRET']}"
    b64_auth = base64.b64encode(auth_str.encode("utf-8")).decode("utf-8")
    
    resp = requests.post(token_url, headers={
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": f"Basic {b64_auth}"
    }, data={
        "grant_type": "client_credentials",
        "scope": "https://api.ebay.com/oauth/api_scope"
    })
    token = resp.json().get("access_token")
    if not token:
        print("Failed to get token:", resp.text)
        return

    print("Got token.")
    
    url = "https://svcs.ebay.com/services/search/FindingService/v1"
    headers = {
        "X-EBAY-SOA-GLOBAL-ID": "EBAY-US",
        "X-EBAY-SOA-OPERATION-NAME": "findCompletedItems",
        "X-EBAY-SOA-SECURITY-IAFTOKEN": token,
        "X-EBAY-SOA-RESPONSE-DATA-FORMAT": "JSON",
    }
    
    params = {
        "keywords": "Shohei Ohtani Topps Chrome",
        "itemFilter(0).name": "SoldItemsOnly",
        "itemFilter(0).value": "true",
        "paginationInput.entriesPerPage": 3,
    }
    
    res = requests.get(url, headers=headers, params=params)
    print("STATUS:", res.status_code)
    try:
        import json
        print("RESPONSE:", json.dumps(res.json(), indent=2))
    except:
        print("TEXT:", res.text)

test()
