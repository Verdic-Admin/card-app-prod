import requests
from bs4 import BeautifulSoup
import urllib.parse
import sys

def test_scrape(query):
    # eBay Sold Items URL structure
    encoded_query = urllib.parse.quote(query)
    url = f"https://www.ebay.com/sch/i.html?_nkw={encoded_query}&LH_Sold=1&LH_Complete=1"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        # Check if we got a captcha or block
        if "captcha" in response.text.lower() or "security" in response.url:
            print("❌ BLOCKED BY EBAY (Captcha / Security redirection)")
            return
            
        soup = BeautifulSoup(response.text, "html.parser")
        
        # In modern eBay, items are generally in <li class="s-item"> 
        items = soup.select(".s-item .s-item__price")
        
        if not items:
            print("⚠️ No price elements found. Either no results, or eBay structure changed/blocked.")
            print("First 500 chars of HTML:", response.text[:500])
            return
            
        print("✅ SUCCESS! Found prices:")
        prices = []
        for item in items[1:6]: # Skip first which is usually a template
            price_text = item.get_text(strip=True).replace("$", "").replace(",", "")
            # Sometimes there's a range like "10.00 to 20.00"
            if "to" in price_text:
                continue
            try:
                prices.append(float(price_text))
                print(f"Price: ${price_text}")
            except ValueError:
                pass
                
        print(f"Extracted {len(prices)} valid prices.")
        
    except Exception as e:
        print(f"❌ ERROR: {e}")

test_scrape("Shohei Ohtani Topps Chrome")
