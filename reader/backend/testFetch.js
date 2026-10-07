const fetchAndTest = async () => {
  try {
    const response = await fetch('https://www.googleapis.com/books/v1/volumes?q=sapiens');
    const data = await response.json();
    console.log(data);
  } catch (err) {
    console.error("Fetch Error:", err);
  }
};
fetchAndTest();
