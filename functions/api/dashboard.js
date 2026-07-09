export async function onRequestGet() {
  const response = await fetch(
    "https://script.google.com/macros/s/AKfycbwhinuB6R-rxHMG4lSkilihzVcFUrGXOQNbhYLrNQfksn-Yy5nxOPFyaUNnRhlpIhRGhw/exec?mode=json"
  );

  return new Response(await response.text(), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
