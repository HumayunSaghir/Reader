const test = async () => {
  const url = "https://en.wikipedia.org/api/rest_v1/page/summary/Sapiens:_A_Brief_History_of_Humankind";
  const r = await fetch(url);
  const d = await r.json();
  console.log(d.extract);
};
test();
