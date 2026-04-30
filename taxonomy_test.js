const { searchTaxonomyAction } = require('./src/app/actions/oracleAPI');
async function test() {
  const res = await searchTaxonomyAction('Tristan Peters');
  console.log(JSON.stringify(res, null, 2));
}
test().catch(console.error);
