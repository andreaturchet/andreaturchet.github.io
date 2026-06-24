const filters = document.querySelectorAll("[data-filter]");
const cards = document.querySelectorAll("[data-topic]");

filters.forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;
    filters.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    cards.forEach((card) => {
      const show = filter === "all" || card.dataset.topic === filter;
      card.hidden = !show;
    });
  });
});

document.querySelectorAll("[data-answer]").forEach((button) => {
  button.addEventListener("click", () => {
    const card = button.closest(".quiz-card");
    const feedback = card.querySelector(".feedback");
    const ok = button.dataset.answer === "true";
    feedback.textContent = ok ? button.dataset.ok : button.dataset.no;
    feedback.className = `feedback ${ok ? "ok" : "no"}`;
  });
});

document.querySelectorAll("[data-check-id]").forEach((box) => {
  const key = `teach-vv-orale:${box.dataset.checkId}`;
  box.checked = localStorage.getItem(key) === "1";
  box.addEventListener("change", () => {
    localStorage.setItem(key, box.checked ? "1" : "0");
  });
});
