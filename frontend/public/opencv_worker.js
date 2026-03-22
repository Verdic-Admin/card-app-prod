self.importScripts('opencv.js');

self.onmessage = function(e) {
    if (e.data.type === 'PROCESS_HARDWARE_SCANS') {
        const { frontsObj, backsObj } = e.data;
        
        if (self.cv && self.cv.getBuildInformation) {
            processScans(frontsObj, backsObj);
        } else {
            self.cv['onRuntimeInitialized'] = () => {
                processScans(frontsObj, backsObj);
            };
        }
    } else if (e.data.type === 'PROCESS_SINGLE_SCAN') {
        const { imageObj, id } = e.data;
        if (self.cv && self.cv.getBuildInformation) {
            processSingleScan(imageObj, id);
        } else {
            self.cv['onRuntimeInitialized'] = () => {
                processSingleScan(imageObj, id);
            };
        }
    }
};

function processScans(frontsObj, backsObj) {
    try {
        const frontCards = processCardsSinglePass(frontsObj.imageData, frontsObj.width, frontsObj.height);
        const sortedFronts = sortCardsGeographic(frontCards);
        
        const backCards = processCardsSinglePass(backsObj.imageData, backsObj.width, backsObj.height);
        const sortedBacks = sortCardsGeographic(backCards);
        
        const numPairs = Math.min(sortedFronts.length, sortedBacks.length);
        const results = [];
        
        for (let i = 0; i < numPairs; i++) {
            const fTight = sortedFronts[i].imgTight;
            const fPadded = sortedFronts[i].imgPadded;
            const bTight = sortedBacks[i].imgTight;
            const bPadded = sortedBacks[i].imgPadded;
            
            // We ship the raw ImageData buffer natively back to the main thread via Structured Clone.
            // Main thread can encode it into jpegs easily.
            results.push({
                name: `card_${String(i + 1).padStart(4, '0')}`,
                frontTightData: imageDataFromMat(fTight),
                frontPaddedData: imageDataFromMat(fPadded),
                backTightData: imageDataFromMat(bTight),
                backPaddedData: imageDataFromMat(bPadded)
            });
            
            fTight.delete(); fPadded.delete();
            bTight.delete(); bPadded.delete();
        }
        
        sortedFronts.forEach(c => c.cleanup && c.cleanup());
        sortedBacks.forEach(c => c.cleanup && c.cleanup());
        
        self.postMessage({ type: 'SUCCESS', count: numPairs, cards: results });
        
    } catch (err) {
        console.error("Worker Execution Error: ", err);
        self.postMessage({ type: 'ERROR', message: err.toString() });
    }
}

function imageDataFromMat(mat) {
    // Convert RGBA WebAssembly array back into JS Native Browser ImageData
    const imgData = new self.ImageData(new Uint8ClampedArray(mat.data), mat.cols, mat.rows);
    return imgData;
}

function processSingleScan(imageObj, id) {
    try {
        const cards = processCardsSinglePass(imageObj.imageData, imageObj.width, imageObj.height);
        
        if (cards && cards.length > 0) {
            // Assume the absolute largest valid contour is the target object
            let c = cards[0]; 
            let result = {
                 id: id,
                 tightData: imageDataFromMat(c.imgTight),
                 paddedData: imageDataFromMat(c.imgPadded)
            };
            
            c.imgTight.delete(); c.imgPadded.delete();
            if (c.cleanup) c.cleanup();
            
            // Clean up memory buffer leaks from any accidentally grabbed smaller artifacts
            for (let i = 1; i < cards.length; i++) {
                cards[i].imgTight.delete(); cards[i].imgPadded.delete();
                if (cards[i].cleanup) cards[i].cleanup();
            }
            
            self.postMessage({ type: 'SINGLE_SUCCESS', result: result });
        } else {
            self.postMessage({ type: 'SINGLE_ERROR', id: id, message: "No edges detected cleanly. Skipping WASM layer." });
        }
    } catch (err) {
        self.postMessage({ type: 'SINGLE_ERROR', id: id, message: err.toString() });
    }
}

function processCardsSinglePass(imageData, width, height) {
    let img = cv.matFromImageData(new self.ImageData(new Uint8ClampedArray(imageData), width, height));
    let gray = new cv.Mat();
    cv.cvtColor(img, gray, cv.COLOR_RGBA2GRAY);
    
    // --- PHASE 1: MACRO DETECTION ---
    let blurredMacro = new cv.Mat();
    let ksize = new cv.Size(15, 15);
    cv.GaussianBlur(gray, blurredMacro, ksize, 0, 0, cv.BORDER_DEFAULT);
    
    let edgesMacro = new cv.Mat();
    cv.Canny(blurredMacro, edgesMacro, 30, 150);
    
    let kernelMacro = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(15, 15));
    let dilatedMacro = new cv.Mat();
    cv.dilate(edgesMacro, dilatedMacro, kernelMacro, new cv.Point(-1, -1), 1);
    
    let closedMacro = new cv.Mat();
    cv.morphologyEx(dilatedMacro, closedMacro, cv.MORPH_CLOSE, kernelMacro, new cv.Point(-1, -1), 2);
    
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(closedMacro, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    
    let validContours = [];
    const minArea = 50000;
    const maxArea = 5000000;
    
    for (let i = 0; i < contours.size(); ++i) {
        let cnt = contours.get(i);
        let area = cv.contourArea(cnt);
        if (area > minArea && area < maxArea) {
            validContours.push({ cnt: cnt, area: area });
        } else {
            cnt.delete();
        }
    }
    
    validContours.sort((a, b) => b.area - a.area);
    let topContours = validContours.slice(0, 12);
    
    for (let i = 12; i < validContours.length; i++) {
        validContours[i].cnt.delete();
    }
    contours.delete(); hierarchy.delete(); closedMacro.delete();
    dilatedMacro.delete(); kernelMacro.delete(); edgesMacro.delete(); blurredMacro.delete();
    
    let extractedCards = [];
    
    for (let item of topContours) {
        let cnt = item.cnt;
        let M = cv.moments(cnt, false);
        
        let cx, cy;
        if (M.m00 !== 0) {
            cx = Math.round(M.m10 / M.m00);
            cy = Math.round(M.m01 / M.m00);
        } else {
            let br = cv.boundingRect(cnt);
            cx = br.x + br.width/2;
            cy = br.y + br.height/2;
        }
        
        let br = cv.boundingRect(cnt);
        let x = br.x, y = br.y, w = br.width, h = br.height;
        
        let pad = 40;
        let x1 = Math.max(0, x - pad);
        let y1 = Math.max(0, y - pad);
        let x2 = Math.min(img.cols, x + w + pad);
        let y2 = Math.min(img.rows, y + h + pad);
        
        let rect = new cv.Rect(x1, y1, x2 - x1, y2 - y1);
        let roiGray = gray.roi(rect);
        
        // PHASE 2: MICRO ISOLATION (Bilateral equivalent)
        // opencv.js bilateralFilter is extremely heavy in JS. Let's use GaussianBlur as a fallback if needed, but we can try bilateral.
        let roiBlur = new cv.Mat();
        cv.bilateralFilter(roiGray, roiBlur, 9, 75, 75, cv.BORDER_DEFAULT);
        
        let roiEdges = new cv.Mat();
        cv.Canny(roiBlur, roiEdges, 40, 150);
        
        let kernelMicro = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
        let roiDilated = new cv.Mat();
        cv.dilate(roiEdges, roiDilated, kernelMicro, new cv.Point(-1, -1), 1);
        
        let roiClosed = new cv.Mat();
        cv.morphologyEx(roiDilated, roiClosed, cv.MORPH_CLOSE, kernelMicro, new cv.Point(-1, -1), 1);
        
        let roiContours = new cv.MatVector();
        let roiHierarchy = new cv.Mat();
        cv.findContours(roiClosed, roiContours, roiHierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        
        if (roiContours.size() === 0) {
            cnt.delete(); roiGray.delete(); roiBlur.delete(); roiEdges.delete(); 
            kernelMicro.delete(); roiDilated.delete(); roiClosed.delete(); 
            roiContours.delete(); roiHierarchy.delete();
            continue;
        }
        
        let maxAreaContour = null;
        let maxRoiArea = -1;
        for (let i = 0; i < roiContours.size(); ++i) {
            let rCnt = roiContours.get(i);
            let rArea = cv.contourArea(rCnt);
            if (rArea > maxRoiArea) {
                maxRoiArea = rArea;
                if (maxAreaContour) maxAreaContour.delete();
                maxAreaContour = rCnt.clone();
            }
            rCnt.delete();
        }
        
        let minRect = cv.minAreaRect(maxAreaContour);
        let box = cv.RotatedRect.points(minRect);
        
        for (let i = 0; i < 4; i++) {
            box[i].x += x1;
            box[i].y += y1;
        }
        
        let orderedPts = orderPoints(box);
        let tl = orderedPts[0], tr = orderedPts[1], brOut = orderedPts[2], bl = orderedPts[3];
        
        let widthA = Math.hypot(brOut.x - bl.x, brOut.y - bl.y);
        let widthB = Math.hypot(tr.x - tl.x, tr.y - tl.y);
        let maxWidth = Math.max(Math.round(widthA), Math.round(widthB));
        
        let heightA = Math.hypot(tr.x - brOut.x, tr.y - brOut.y);
        let heightB = Math.hypot(tl.x - bl.x, tl.y - bl.y);
        let maxHeight = Math.max(Math.round(heightA), Math.round(heightB));
        
        let finalW, finalH, isLandscape;
        if (maxWidth > maxHeight) {
            finalW = 1050; finalH = 750;
            isLandscape = true;
        } else {
            finalW = 750; finalH = 1050;
            isLandscape = false;
        }
        
        let shavePx = 14;
        let p1 = cv.matFromArray(4, 1, cv.CV_32FC2, [tl.x, tl.y, tr.x, tr.y, brOut.x, brOut.y, bl.x, bl.y]);
        let p2 = cv.matFromArray(4, 1, cv.CV_32FC2, [
            -shavePx, -shavePx,
            finalW - 1 + shavePx, -shavePx,
            finalW - 1 + shavePx, finalH - 1 + shavePx,
            -shavePx, finalH - 1 + shavePx
        ]);
        
        let matrix = cv.getPerspectiveTransform(p1, p2);
        let warpedTight = new cv.Mat();
        let dsize = new cv.Size(finalW, finalH);
        cv.warpPerspective(img, warpedTight, matrix, dsize, cv.INTER_CUBIC, cv.BORDER_CONSTANT, new cv.Scalar());
        
        let pad_px = 50;
        let p1_pad = cv.matFromArray(4, 1, cv.CV_32FC2, [tl.x, tl.y, tr.x, tr.y, brOut.x, brOut.y, bl.x, bl.y]);
        let p2_pad = cv.matFromArray(4, 1, cv.CV_32FC2, [
            pad_px, pad_px,
            finalW - 1 + pad_px, pad_px,
            finalW - 1 + pad_px, finalH - 1 + pad_px,
            pad_px, finalH - 1 + pad_px
        ]);
        let matrix_pad = cv.getPerspectiveTransform(p1_pad, p2_pad);
        let warpedPadded = new cv.Mat();
        let dsize_pad = new cv.Size(finalW + pad_px * 2, finalH + pad_px * 2);
        cv.warpPerspective(img, warpedPadded, matrix_pad, dsize_pad, cv.INTER_CUBIC, cv.BORDER_CONSTANT, new cv.Scalar());
        
        if (isLandscape) {
            let rotated = new cv.Mat();
            cv.rotate(warpedTight, rotated, cv.ROTATE_90_CLOCKWISE);
            warpedTight.delete();
            warpedTight = rotated;
            
            let rotatedPad = new cv.Mat();
            cv.rotate(warpedPadded, rotatedPad, cv.ROTATE_90_CLOCKWISE);
            warpedPadded.delete();
            warpedPadded = rotatedPad;
        }
        
        extractedCards.push({
            imgTight: warpedTight,
            imgPadded: warpedPadded,
            center: [cx, cy],
            cleanup: () => {} 
        });
        
        cnt.delete(); roiGray.delete(); roiBlur.delete(); roiEdges.delete(); 
        kernelMicro.delete(); roiDilated.delete(); roiClosed.delete(); 
        roiContours.delete(); roiHierarchy.delete(); maxAreaContour.delete();
        p1.delete(); p2.delete(); matrix.delete();
        p1_pad.delete(); p2_pad.delete(); matrix_pad.delete();
    }
    
    img.delete();
    gray.delete();
    return extractedCards;
}

function sortCardsGeographic(cards, rowTolerance = 300) {
    if (!cards || cards.length === 0) return [];
    
    cards.sort((a, b) => a.center[1] - b.center[1]);
    let rows = [];
    let currentRow = [cards[0]];
    
    for (let i = 1; i < cards.length; i++) {
        let card = cards[i];
        if (Math.abs(card.center[1] - currentRow[currentRow.length - 1].center[1]) <= rowTolerance) {
            currentRow.push(card);
        } else {
            rows.push(currentRow);
            currentRow = [card];
        }
    }
    rows.push(currentRow);
    
    let sortedGrid = [];
    for (let row of rows) {
        row.sort((a, b) => a.center[0] - b.center[0]);
        sortedGrid = sortedGrid.concat(row);
    }
    return sortedGrid;
}

function orderPoints(box) {
    let pts = [...box];
    let rect = new Array(4);
    
    let s = pts.map(p => p.x + p.y);
    let minS = Math.min(...s);
    let maxS = Math.max(...s);
    rect[0] = pts[s.indexOf(minS)];
    rect[2] = pts[s.indexOf(maxS)];
    
    let diff = pts.map(p => p.y - p.x);
    let minD = Math.min(...diff);
    let maxD = Math.max(...diff);
    rect[1] = pts[diff.indexOf(minD)];
    rect[3] = pts[diff.indexOf(maxD)];
    
    return rect;
}
