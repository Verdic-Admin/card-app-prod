import cv2
import numpy as np
import os
import argparse

def order_points(pts):
    """Sorts 4 points mathematically: top-left, top-right, bottom-right, bottom-left.
       Crucial to ensure the card isn't flipped or twisted during Homography."""
    rect = np.zeros((4, 2), dtype="float32")
    
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)] # Top-Left
    rect[2] = pts[np.argmax(s)] # Bottom-Right
    
    diff = np.diff(pts, axis=1) # y - x
    rect[1] = pts[np.argmin(diff)] # Top-Right
    rect[3] = pts[np.argmax(diff)] # Bottom-Left
    return rect

def process_cards_single_pass(image_path, min_area=50000, max_area=5000000, shave_px=14):
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Could not load image: {image_path}")
        
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # --- PHASE 1: MACRO DETECTION ---
    # Heavily blurred global search to find the general mass of the cards on the glass
    blurred_macro = cv2.GaussianBlur(gray, (15, 15), 0)
    edges_macro = cv2.Canny(blurred_macro, 30, 150)
    
    kernel_macro = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
    dilated_macro = cv2.dilate(edges_macro, kernel_macro, iterations=1)
    closed_macro = cv2.morphologyEx(dilated_macro, cv2.MORPH_CLOSE, kernel_macro, iterations=2)
    
    contours, _ = cv2.findContours(closed_macro, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # Filter valid card contours and sort by area descending (cap at 12 cards)
    valid_contours = [c for c in contours if min_area < cv2.contourArea(c) < max_area]
    valid_contours.sort(key=cv2.contourArea, reverse=True)
    top_contours = valid_contours[:12]
    
    print(f"[{os.path.basename(image_path)}] Discovered {len(top_contours)} valid cards.")
    
    extracted_cards = []
    
    for cnt in top_contours:
        # Get global Centroid for geographic sorting later
        M = cv2.moments(cnt)
        cx = int(M["m10"] / M["m00"]) if M["m00"] != 0 else int(cv2.minAreaRect(cnt)[0][0])
        cy = int(M["m01"] / M["m00"]) if M["m00"] != 0 else int(cv2.minAreaRect(cnt)[0][1])
            
        x, y, w, h = cv2.boundingRect(cnt)
        
        # Extract a safe, padded localized ROI from the RAW high-res original image
        pad = 40 
        x1, y1 = max(0, x - pad), max(0, y - pad)
        x2, y2 = min(img.shape[1], x + w + pad), min(img.shape[0], y + h + pad)
        roi_gray = gray[y1:y2, x1:x2]
        
        # --- PHASE 2: MICRO PRECISION ISOLATION ---
        # Bilateral filter removes scanner mat texture but preserves razor-sharp card edges
        roi_blur = cv2.bilateralFilter(roi_gray, 9, 75, 75)
        roi_edges = cv2.Canny(roi_blur, 40, 150)
        
        # Dilate to bridge 1-pixel breaks in the border (often caused by foils/glare)
        kernel_micro = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        roi_dilated = cv2.dilate(roi_edges, kernel_micro, iterations=1)
        roi_closed = cv2.morphologyEx(roi_dilated, cv2.MORPH_CLOSE, kernel_micro, iterations=1)
        
        roi_contours, _ = cv2.findContours(roi_closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not roi_contours:
            continue
            
        # The largest connected shape inside this local isolated ROI is mathematically the card
        card_cnt = max(roi_contours, key=cv2.contourArea)
        
        # Calculate the pure mathematical minimum bounding rotated rectangle
        rect = cv2.minAreaRect(card_cnt)
        box = cv2.boxPoints(rect)
        
        # Translate the local ROI coordinates back to the global raw image coordinate space
        box[:, 0] += x1
        box[:, 1] += y1
        ordered_pts = order_points(box)
        (tl, tr, br, bl) = ordered_pts
        
        # Determine strict logical placement (Portrait vs Landscape)
        widthA = np.linalg.norm(br - bl)
        widthB = np.linalg.norm(tr - tl)
        maxWidth = max(int(widthA), int(widthB))

        heightA = np.linalg.norm(tr - br)
        heightB = np.linalg.norm(tl - bl)
        maxHeight = max(int(heightA), int(heightB))
        
        if maxWidth > maxHeight:
            final_w, final_h = 1050, 750
            is_landscape = True
        else:
            final_w, final_h = 750, 1050
            is_landscape = False
            
        # --- PHASE 3: SINGLE-PASS HOMOGRAPHY & THE SHAVE ---
        # THE FIX: We map the exact corners of the card mathematically OUTSIDE our target canvas.
        # By pulling the destination coordinates back by `-shave_px`, OpenCV natively acts like 
        # a zoom lens, slicing a perfectly straight border deep into the card structure.
        # This completely eradicates scanner mat boundaries and pure black triangles.
        dst_pts = np.array([
            [-shave_px, -shave_px],
            [final_w - 1 + shave_px, -shave_px],
            [final_w - 1 + shave_px, final_h - 1 + shave_px],
            [-shave_px, final_h - 1 + shave_px]
        ], dtype="float32")
        
        Matrix = cv2.getPerspectiveTransform(ordered_pts, dst_pts)
        warped_tight = cv2.warpPerspective(img, Matrix, (final_w, final_h), flags=cv2.INTER_CUBIC)
        
        # Padded Backup (+50 boundary buffer -> +100 to overall dimensions)
        pad_px = 50
        final_w_pad = final_w + (pad_px * 2)
        final_h_pad = final_h + (pad_px * 2)
        
        dst_pts_padded = np.array([
            [pad_px, pad_px],
            [final_w - 1 + pad_px, pad_px],
            [final_w - 1 + pad_px, final_h - 1 + pad_px],
            [pad_px, final_h - 1 + pad_px]
        ], dtype="float32")
        
        Matrix_padded = cv2.getPerspectiveTransform(ordered_pts, dst_pts_padded)
        warped_padded = cv2.warpPerspective(img, Matrix_padded, (final_w_pad, final_h_pad), flags=cv2.INTER_CUBIC)
        
        # Standardize Landscape output
        if is_landscape:
            warped_tight = cv2.rotate(warped_tight, cv2.ROTATE_90_CLOCKWISE)
            warped_padded = cv2.rotate(warped_padded, cv2.ROTATE_90_CLOCKWISE)
            
        extracted_cards.append({
            'img_tight': warped_tight,
            'img_padded': warped_padded,
            'center': (cx, cy)
        })
        
    return extracted_cards

def sort_cards_geographic(cards, row_tolerance=300):
    """Sorts matched cards geometrically (Top-to-Bottom, Left-to-Right)"""
    if not cards: return []
    cards_sorted_y = sorted(cards, key=lambda c: c['center'][1])
    
    rows = []
    current_row = [cards_sorted_y[0]]
    for card in cards_sorted_y[1:]:
        if abs(card['center'][1] - current_row[-1]['center'][1]) <= row_tolerance:
            current_row.append(card)
        else:
            rows.append(current_row)
            current_row = [card]
    rows.append(current_row)
    
    sorted_grid = []
    for row in rows:
        row_sorted_x = sorted(row, key=lambda c: c['center'][0])
        sorted_grid.extend(row_sorted_x)
    return sorted_grid

def main():
    parser = argparse.ArgumentParser(description="Master 1-Step Card Processing Pipeline")
    parser.add_argument("--fronts", required=True, help="Path to the fronts scan image")
    parser.add_argument("--backs", required=True, help="Path to the backs scan image")
    parser.add_argument("--outdir", default="Final_Output", help="Output directory")
    parser.add_argument("--backupdir", default="Manual_Backups", help="Directory for padded unmodified outputs")
    parser.add_argument("--shave", type=int, default=14, help="Target pixels to natively shave inwards to guarantee 0 border")
    
    args = parser.parse_args()
    os.makedirs(args.outdir, exist_ok=True)
    os.makedirs(args.backupdir, exist_ok=True)
    
    print("Isolating Fronts...")
    front_cards = process_cards_single_pass(args.fronts, shave_px=args.shave)
    sorted_fronts = sort_cards_geographic(front_cards)
    
    print("\nIsolating Backs...")
    back_cards = process_cards_single_pass(args.backs, shave_px=args.shave)
    sorted_backs = sort_cards_geographic(back_cards)
    
    num_pairs = min(len(sorted_fronts), len(sorted_backs))
    print(f"\nSuccessfully mapped {num_pairs} complete pairs. Saving...")
    
    for i in range(num_pairs):
        final_front_tight = sorted_fronts[i]['img_tight']
        final_back_tight = sorted_backs[i]['img_tight']
        
        final_front_padded = sorted_fronts[i]['img_padded']
        final_back_padded = sorted_backs[i]['img_padded']
        
        f_path_tight = os.path.join(args.outdir, f"card_{i+1:04d}_SideA.jpg")
        b_path_tight = os.path.join(args.outdir, f"card_{i+1:04d}_SideB.jpg")
        
        f_path_pad = os.path.join(args.backupdir, f"card_{i+1:04d}_SideA.jpg")
        b_path_pad = os.path.join(args.backupdir, f"card_{i+1:04d}_SideB.jpg")
        
        cv2.imwrite(f_path_tight, final_front_tight)
        cv2.imwrite(b_path_tight, final_back_tight)
        
        cv2.imwrite(f_path_pad, final_front_padded)
        cv2.imwrite(b_path_pad, final_back_padded)
        
        print(f"Perfectly Extracted: {f_path_tight} & {b_path_tight}")
        
    print("\nPipeline Complete! Enjoy zero borders.")

if __name__ == "__main__":
    main()
