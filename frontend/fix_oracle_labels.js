const fs = require('fs');

function scrub(path) {
    if (!fs.existsSync(path)) return;
    let content = fs.readFileSync(path, 'utf8');
    
    // UI Label text replacements
    content = content.replace(/Oracle Value/g, 'Player Index Value');
    content = content.replace(/Oracle Trend/g, 'Index Trend');
    content = content.replace(/Auto-Price with Oracle/g, 'Auto-Price with Player Index');
    content = content.replace(/Error communicating with Oracle/g, 'Error communicating with Player Index');
    content = content.replace(/Oracle evaluation returned/g, 'Player Index evaluation returned');
    content = content.replace(/Oracle Orchestration Batch Importer/g, 'Player Index Batch Importer');
    content = content.replace(/Oracle Catalog Clarifications/g, 'Player Index Clarifications');
    content = content.replace(/The Oracle matched your listings/g, 'The Player Index matched your listings');
    content = content.replace(/Oracle "Did You Mean\?" Suggestion/g, 'Player Index "Did You Mean?" Suggestion');
    content = content.replace(/Oracle Corrected Spelling/g, 'Player Index Corrected Spelling');
    content = content.replace(/Apply Oracle pricing/g, 'Apply Player Index pricing');
    content = content.replace(/Apply All Oracle/g, 'Apply All Player Index');
    content = content.replace(/ALL items with their Oracle catalog matches\?/g, 'ALL items with their Player Index catalog matches?');
    
    fs.writeFileSync(path, content);
}

scrub('src/components/ProductCard.tsx');
scrub('src/components/admin/AdminDashboard.tsx');
scrub('src/components/admin/BulkIngestionWizard.tsx');
scrub('src/components/admin/InventoryTable.tsx');
console.log('Oracle UI texts replaced');
