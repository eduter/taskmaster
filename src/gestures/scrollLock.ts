const LOCK_CLASS = "task-gesture-scroll-lock";

function lockGestureScroll() {
  document.documentElement.classList.add(LOCK_CLASS);
  document.body.classList.add(LOCK_CLASS);
}

function unlockGestureScroll() {
  document.documentElement.classList.remove(LOCK_CLASS);
  document.body.classList.remove(LOCK_CLASS);
}

export { lockGestureScroll, unlockGestureScroll };
