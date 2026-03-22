import os
import cv2
import base64
import numpy as np
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from master_pipeline import process_cards_single_pass, sort_cards_geographic

app = FastAPI(title="Local Hardware Scanner Sidecar")

# Allow Next.js frontend (localhost:3000) to natively pipe raw images directly here
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BACKUP_DIR = "Manual_Backups"
os.makedirs(BACKUP_DIR, exist_ok=True)

@app.post("/api/local-scan")
async def local_scan(fronts: UploadFile = File(...), backs: UploadFile = File(...)):
    print(f"Hardware Sync Engaged: Fronts({fronts.filename}) Backs({backs.filename})")
    
    # Dump the huge raw flatbed scans to local temp files so OpenCV can parse them
    fronts_path = os.path.join(BACKUP_DIR, "temp_fronts.jpg")
    backs_path = os.path.join(BACKUP_DIR, "temp_backs.jpg")
    
    with open(fronts_path, "wb") as f:
        f.write(await fronts.read())
    with open(backs_path, "wb") as f:
        f.write(await backs.read())
        
    print("Executing Deep Canny Edges on Fronts...")
    front_cards = process_cards_single_pass(fronts_path, shave_px=14)
    sorted_fronts = sort_cards_geographic(front_cards)
    
    print("Executing Deep Canny Edges on Backs...")
    back_cards = process_cards_single_pass(backs_path, shave_px=14)
    sorted_backs = sort_cards_geographic(back_cards)
    
    num_pairs = min(len(sorted_fronts), len(sorted_backs))
    print(f"Native OpenCV Successfully sliced {num_pairs} perfect pairs. Generating B64 Payload...")
    
    results = []
    
    for i in range(num_pairs):
        f_tight = sorted_fronts[i]['img_tight']
        b_tight = sorted_backs[i]['img_tight']
        f_pad = sorted_fronts[i]['img_padded']
        b_pad = sorted_backs[i]['img_padded']
        
        # Save safe padded versions natively to the backup directory
        f_pad_path = os.path.join(BACKUP_DIR, f"card_{i+1:04d}_SideA.jpg")
        b_pad_path = os.path.join(BACKUP_DIR, f"card_{i+1:04d}_SideB.jpg")
        cv2.imwrite(f_pad_path, f_pad)
        cv2.imwrite(b_pad_path, b_pad)
        
        # Convert perfectly sliced tight crops into base64 JPEG strings dynamically
        _, f_buffer = cv2.imencode('.jpg', f_tight, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
        _, b_buffer = cv2.imencode('.jpg', b_tight, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
        
        f_b64 = base64.b64encode(f_buffer).decode('utf-8')
        b_b64 = base64.b64encode(b_buffer).decode('utf-8')
        
        results.append({
            "name": f"card_{i+1:04d}",
            "frontBase64": f"data:image/jpeg;base64,{f_b64}",
            "backBase64": f"data:image/jpeg;base64,{b_b64}"
        })
        
    try:
        os.remove(fronts_path)
        os.remove(backs_path)
    except Exception as e:
        print(f"Cleanup error: {e}")
        
    print("Cycle Terminated. Relaying JSON array back to Next.js.")
    return {"success": True, "count": num_pairs, "cards": results}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
