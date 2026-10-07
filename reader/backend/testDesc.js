const testDesc = async () => {
  const url1 = "https://openlibrary.org/api/books?bibkeys=ISBN:9780140328721&jscmd=details&format=json";
  const r1 = await fetch(url1);
  const d1 = await r1.json();
  console.log("Details endpoint:", JSON.stringify(d1).substring(0, 300));
  
  const url2 = "https://openlibrary.org/works/OL1168010W.json";
  const r2 = await fetch(url2);
  const d2 = await r2.json();
  console.log("Works endpoint description:", d2.description);
};
testDesc();
