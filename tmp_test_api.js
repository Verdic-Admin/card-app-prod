fetch('http://localhost:3000/api/ebay-comps?q=Ohtani+Topps')
.then(r=>r.text())
.then(text => console.log("API Response:", text))
.catch(err => console.error("Error:", err))
