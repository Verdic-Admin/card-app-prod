const fs = require('fs');
let c = fs.readFileSync('src/components/admin/BulkIngestionWizard.tsx', 'utf8');

// 1. Add new state variables
const stateTarget = `  const [images, setImages] = useState<File[]>([])`;
const stateReplacement = `  const [images, setImages] = useState<File[]>([])
  const [uploadMode, setUploadMode] = useState<'batch' | 'single'>('batch')
  const [singleFront, setSingleFront] = useState<File | null>(null)
  const [singleBack, setSingleBack] = useState<File | null>(null)`;
c = c.replace(stateTarget, stateReplacement);

// 2. Modify handleUpload
const handleUploadTarget = `  const handleUpload = async () => {
    if (images.length === 0) return
    setIsUploading(true)
    try {
       const userStr = localStorage.getItem('supabase_user_cache')
       let shopId = "test_shop"
       if (userStr) {
          const user = JSON.parse(userStr)
          shopId = user.id
       }
       
       // Note: we must map them correctly with correct types to base64
       const base64Images = await Promise.all(images.map(fileToBase64))`;

const handleUploadReplacement = `  const handleUpload = async () => {
    const filesToProcess = uploadMode === 'batch' ? images : [singleFront, singleBack].filter(f => f) as File[]
    if (filesToProcess.length === 0) return
    setIsUploading(true)
    try {
       const userStr = localStorage.getItem('supabase_user_cache')
       let shopId = "test_shop"
       if (userStr) {
          const user = JSON.parse(userStr)
          shopId = user.id
       }
       
       const base64Images = await Promise.all(filesToProcess.map(fileToBase64))`;
c = c.replace(handleUploadTarget, handleUploadReplacement);

// 3. Replace step 1 UI block
const step1Target = `{step === 1 && (
        <div className="space-y-8 animate-in fade-in">
          <div>
            <label className="block text-sm font-bold text-foreground mb-3 uppercase tracking-wider">Drag Files</label>
            <div 
              className={\`border-2 border-dashed border-brand/30 bg-brand/5 rounded-2xl h-56 flex flex-col items-center justify-center cursor-pointer hover:bg-surface-hover transition shadow-inner\`}
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <Upload className="w-8 h-8 text-brand/70 mb-3" />
              <span className="text-sm font-bold text-brand">
                 {images.length > 0 ? \`\${images.length} Files Selected\` : 'Click or Drop Image files'}
              </span>
              <input id="file-upload" type="file" multiple accept="image/*" className="hidden" onChange={e => {if(e.target.files) setImages(Array.from(e.target.files))}} />
            </div>
          </div>
          <button 
            onClick={handleUpload}
            disabled={isUploading || images.length === 0 || creditsExhausted}
            className="w-full bg-brand text-background font-black text-lg py-4 rounded-xl disabled:opacity-50 hover:bg-brand-hover hover:shadow transition flex items-center justify-center gap-3"
          >
            {isUploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Play className="w-6 h-6" />} Submit Batch to AssetProcessor
          </button>
        </div>
      )}`;

const step1Replacement = `{step === 1 && (
        <div className="space-y-8 animate-in fade-in">
          <div className="flex bg-surface border border-border rounded-lg p-1 w-full max-w-sm mx-auto mb-2">
            <button 
               onClick={() => setUploadMode('batch')} 
               className={\`flex-1 py-2 text-sm font-bold rounded-md transition \${uploadMode === 'batch' ? 'bg-brand text-brand-foreground shadow' : 'text-muted hover:text-foreground'}\`}>
               Batch Matrix
            </button>
            <button 
               onClick={() => setUploadMode('single')} 
               className={\`flex-1 py-2 text-sm font-bold rounded-md transition \${uploadMode === 'single' ? 'bg-brand text-brand-foreground shadow' : 'text-muted hover:text-foreground'}\`}>
               Single Pair
            </button>
          </div>

          {uploadMode === 'batch' ? (
            <div>
              <label className="block text-sm font-bold text-foreground mb-3 uppercase tracking-wider text-center">Batch Dropzone (9 Cards per scan)</label>
              <div 
                className={\`border-2 border-dashed border-brand/30 bg-brand/5 rounded-2xl h-56 flex flex-col items-center justify-center cursor-pointer hover:bg-surface-hover transition shadow-inner\`}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  if(e.dataTransfer.files) setImages(Array.from(e.dataTransfer.files));
                }}
                onClick={() => document.getElementById('file-upload-batch')?.click()}
              >
                <Upload className="w-8 h-8 text-brand/70 mb-3" />
                <span className="text-sm font-bold text-brand">
                   {images.length > 0 ? \`\${images.length} Files Selected\` : 'Click or Drop Matrices'}
                </span>
                <input id="file-upload-batch" type="file" multiple accept="image/*" className="hidden" onChange={e => {if(e.target.files) setImages(Array.from(e.target.files))}} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-sm font-bold text-foreground mb-3 uppercase tracking-wider text-center">Front Side</label>
                  <div 
                    className={\`border-2 border-dashed border-brand/30 bg-brand/5 rounded-2xl h-56 flex flex-col items-center justify-center cursor-pointer hover:bg-surface-hover transition shadow-inner\`}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      e.preventDefault();
                      if(e.dataTransfer.files?.[0]) setSingleFront(e.dataTransfer.files[0]);
                    }}
                    onClick={() => document.getElementById('file-upload-front')?.click()}
                  >
                    <Upload className="w-8 h-8 text-brand/70 mb-3" />
                    <span className="text-sm font-bold text-brand text-center px-4">
                       {singleFront ? singleFront.name : '+ Drop Front'}
                    </span>
                    <input id="file-upload-front" type="file" accept="image/*" className="hidden" onChange={e => {if(e.target.files?.[0]) setSingleFront(e.target.files[0])}} />
                  </div>
               </div>
               <div>
                  <label className="block text-sm font-bold text-foreground mb-3 uppercase tracking-wider text-center">Back Side</label>
                  <div 
                    className={\`border-2 border-dashed border-brand/30 bg-brand/5 rounded-2xl h-56 flex flex-col items-center justify-center cursor-pointer hover:bg-surface-hover transition shadow-inner\`}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      e.preventDefault();
                      if(e.dataTransfer.files?.[0]) setSingleBack(e.dataTransfer.files[0]);
                    }}
                    onClick={() => document.getElementById('file-upload-back')?.click()}
                  >
                    <Upload className="w-8 h-8 text-brand/70 mb-3" />
                    <span className="text-sm font-bold text-brand text-center px-4">
                       {singleBack ? singleBack.name : '+ Drop Back'}
                    </span>
                    <input id="file-upload-back" type="file" accept="image/*" className="hidden" onChange={e => {if(e.target.files?.[0]) setSingleBack(e.target.files[0])}} />
                  </div>
               </div>
            </div>
          )}

          <button 
            onClick={handleUpload}
            disabled={isUploading || creditsExhausted || (uploadMode === 'batch' ? images.length === 0 : (!singleFront || !singleBack))}
            className="w-full bg-brand text-background font-black text-lg py-4 rounded-xl disabled:opacity-50 hover:bg-brand-hover hover:shadow transition flex items-center justify-center gap-3"
          >
            {isUploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Play className="w-6 h-6" />} Submit to AssetProcessor
          </button>
        </div>
      )}`;

if (c.includes(step1Target)) {
   c = c.replace(step1Target, step1Replacement);
   fs.writeFileSync('src/components/admin/BulkIngestionWizard.tsx', c);
   console.log('UI Patched!');
} else {
   console.log("Could not find step 1 target code block.");
}
