const test = async () => {
  const url = "https://openlibrary.org/api/books?bibkeys=ISBN:9780140328721&jscmd=details&format=json";
  const r = await fetch(url);
  const d = await r.json();
  console.log(JSON.stringify(d, null, 2));
};
test();
