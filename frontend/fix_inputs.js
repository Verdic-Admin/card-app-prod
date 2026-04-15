const fs = require('fs');

function scrub(path) {
    if (!fs.existsSync(path)) return;
    let content = fs.readFileSync(path, 'utf8');
    
    // Convert null-able string values to empty string fallback in JSX
    content = content.replace(/value=\{settings\.site_announcement\}/g, "value={settings.site_announcement || ''}");
    content = content.replace(/value=\{settings\.store_description\}/g, "value={settings.store_description || ''}");
    content = content.replace(/value=\{settings\.social_instagram\}/g, "value={settings.social_instagram || ''}");
    content = content.replace(/value=\{settings\.social_twitter\}/g, "value={settings.social_twitter || ''}");
    content = content.replace(/value=\{settings\.social_facebook\}/g, "value={settings.social_facebook || ''}");
    content = content.replace(/value=\{settings\.social_discord\}/g, "value={settings.social_discord || ''}");
    content = content.replace(/value=\{settings\.social_threads\}/g, "value={settings.social_threads || ''}");
    
    // Also fix the payment fields in settings just in case
    content = content.replace(/value=\{settings\.payment_venmo\}/g, "value={settings.payment_venmo || ''}");
    content = content.replace(/value=\{settings\.payment_paypal\}/g, "value={settings.payment_paypal || ''}");
    content = content.replace(/value=\{settings\.payment_cashapp\}/g, "value={settings.payment_cashapp || ''}");
    content = content.replace(/value=\{settings\.payment_zelle\}/g, "value={settings.payment_zelle || ''}");
    content = content.replace(/value=\{settings\.payment_instructions\}/g, "value={settings.payment_instructions || ''}");

    fs.writeFileSync(path, content);
}

scrub('src/app/admin/design/page.tsx');
scrub('src/app/admin/settings/page.tsx');
console.log('React controlled input warnings fixed');
