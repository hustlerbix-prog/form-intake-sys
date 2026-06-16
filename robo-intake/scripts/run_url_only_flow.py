from playwright.sync_api import sync_playwright
import os
import time


BASE = os.environ.get("APP_URL", "http://localhost:3001")
LOG_PATH = os.path.join(os.getcwd(), ".data", "scraper.log")


def main():
  with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto(BASE + "/analyse")
    page.wait_for_load_state("networkidle")

    page.wait_for_selector('button[aria-label="Toggle URL-only"]', timeout=20000)
    page.click('button[aria-label="Toggle URL-only"]')

    page.wait_for_selector("text=What is your business website URL?", timeout=20000)
    page.fill("textarea", "https://example.com")
    page.get_by_role("button", name="Send").click()

    page.wait_for_selector("text=Last step — where should we send your report?", timeout=20000)
    page.get_by_label("Your first name").fill("Test")
    page.get_by_label("Your email address").fill("test@example.com")
    page.get_by_role("button", name="Get my free analysis").click()

    page.wait_for_selector("text=Your analysis is underway", timeout=20000)
    time.sleep(5)
    browser.close()

  print("Submitted. Last log lines:")
  if os.path.exists(LOG_PATH):
    with open(LOG_PATH, "r", encoding="utf-8") as f:
      lines = f.read().splitlines()
    for line in lines[-30:]:
      print(line)
  else:
    print("No log file found at", LOG_PATH)


if __name__ == "__main__":
  main()

