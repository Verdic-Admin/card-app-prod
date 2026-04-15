const fs = require('fs');
let c = fs.readFileSync('src/components/admin/BulkIngestionWizard.tsx', 'utf8');

const oldHandleUpload = `const handleUpload = async () => {
    if (images.length === 0) return
    setIsUploading(true)
    try {
       const uploadPromises = images.map(async (img) => {`;

const newHandleUpload = `const handleUpload = async () => {
    const filesToProcess = uploadMode === 'batch' ? images : [singleFront, singleBack].filter(f => f);
    if (filesToProcess.length === 0) return;
    setIsUploading(true)
    try {
       const uploadPromises = filesToProcess.map(async (img) => {`;

c = c.replace(oldHandleUpload, newHandleUpload);

c = c.split("Submit to AssetProcessor").join("Submit");

fs.writeFileSync('src/components/admin/BulkIngestionWizard.tsx', c);
console.log('Fixed handleUpload and Button text');
