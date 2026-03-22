import os
import requests
from dotenv import load_dotenv

load_dotenv("frontend/.env.local")

def get_token():
    auth_str = f"{os.environ['EBAY_CLIENT_ID']}:{os.environ['EBAY_CLIENT_SECRET']}"
    import base64
    b64_auth = base64.b64encode(auth_str.encode("utf-8")).decode("utf-8")
    resp = requests.post(
        "https://api.ebay.com/identity/v1/oauth2/token",
        headers={"Authorization": f"Basic {b64_auth}", "Content-Type": "application/x-www-form-urlencoded"},
        data={"grant_type": "client_credentials", "scope": "https://api.ebay.com/oauth/api_scope"}
    )
    return resp.json()["access_token"]

def test_browse():
    token = get_token()
    url = "https://api.ebay.com/buy/browse/v1/item_summary/search"
    # To get completed/sold items in the Browse API, you need to use the `filter` parameter.
    # However, the Browse API currently does not support searching sold items *except* with specific permissions, BUT wait.
    # Does the browse API support sold items? 
    # Actually, the Browse API "search" method doesn't officially support "SoldItemsOnly" filter easily without a compat level or different endpoint.
    # Wait, the documentation says `filter=buyingOptions:{AUCTION|FIXED_PRICE}` but for sold items, there isn't a simple filter if you don't have Market Insights.
    # Let me check if `q` with `api.ebay.com/buy/browse/v1/item_summary/search` works or if there's another way.
    # Wait, we can just make a test request.
    resp = requests.get(
        url,
        headers={"Authorization": f"Bearer {token}"},
        params={"q": "Shohei Ohtani Topps Chrome", "limit": 3}
    )
    print(resp.json())

test_browse()
