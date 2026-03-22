import requests

def test_130point():
    url = "https://130point.com/sales/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    }
    try:
        r = requests.get(url, headers=headers, timeout=5)
        print("Status Code:", r.status_code)
        if "cloudflare" in r.text.lower() or "just a moment" in r.text.lower():
            print("❌ Blocked by Cloudflare.")
        else:
            print("✅ Loaded main page. Title:", r.text.split('<title>')[1].split('</title>')[0] if '<title>' in r.text else 'No Title')
            
        # Try the AJAX endpoint
        ajax_url = "https://130point.com/wp-admin/admin-ajax.php"
        data = {
            "action": "search_130",
            "query": "Shohei Ohtani Topps Chrome",
        }
        r2 = requests.post(ajax_url, headers=headers, data=data, timeout=5)
        print("AJAX Status Code:", r2.status_code)
        if "cloudflare" in r2.text.lower() or "just a moment" in r2.text.lower() or "error" in r2.text.lower():
            print("❌ AJAX blocked.")
        else:
            print("AJAX Response preview:", r2.text[:200])
    except Exception as e:
        print("ERROR:", e)

test_130point()
