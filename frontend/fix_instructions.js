const fs = require('fs');
let c1 = fs.readFileSync('src/components/admin/CoinRequestsCRM.tsx', 'utf8');
c1 = c1.replace('title="Coin Requests CRM"', 'title="Coin Requests"');
fs.writeFileSync('src/components/admin/CoinRequestsCRM.tsx', c1);

let c2 = fs.readFileSync('src/components/admin/TradeLeadsCRM.tsx', 'utf8');
c2 = c2.replace('text-xl font-bold text-foreground flex', 'text-xl font-bold text-slate-900 flex');
c2 = c2.replace('text-sm font-medium text-muted', 'text-sm font-medium text-slate-500');
fs.writeFileSync('src/components/admin/TradeLeadsCRM.tsx', c2);

let c3 = fs.readFileSync('src/components/admin/BulkIngestionWizard.tsx', 'utf8');
c3 = c3.replace('taxonomy fields', 'card details').replace('taxonomy search', 'manual search');
fs.writeFileSync('src/components/admin/BulkIngestionWizard.tsx', c3);

let c4 = fs.readFileSync('src/app/admin/page.tsx', 'utf8');
c4 = c4.replace('The background Oracle constantly', 'The background Player Index constantly');
fs.writeFileSync('src/app/admin/page.tsx', c4);
console.log('Fixed instructions content!');
