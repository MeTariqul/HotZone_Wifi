#!/usr/bin/env python3
"""
Web Interface Preview Generator
Captures screenshots of all pages for the HotZone captive portal system.
"""
import os
import time
import subprocess
import signal
import sys
from pathlib import Path

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager


class PreviewGenerator:
    def __init__(self, base_url="http://localhost:3000", output_dir="preview"):
        self.base_url = base_url
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        self.server_process = None
        self.driver = None

    def start_server(self):
        """Start Next.js dev server."""
        webapp_dir = Path(__file__).parent
        print(f"Starting Next.js server in {webapp_dir}...")
        self.server_process = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=webapp_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        # Wait for server to be ready
        for i in range(30):
            try:
                import requests
                resp = requests.get(self.base_url, timeout=2)
                if resp.status_code == 200:
                    print("Server ready!")
                    return
            except Exception:
                pass
            time.sleep(1)
        raise RuntimeError("Server failed to start")

    def setup_driver(self):
        """Setup Selenium Chrome driver."""
        chrome_options = Options()
        chrome_options.add_argument("--headless=new")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument("--force-device-scale-factor=1")
        chrome_options.binary_location = "/usr/bin/google-chrome"

        service = Service(ChromeDriverManager().install())
        self.driver = webdriver.Chrome(service=service, options=chrome_options)
        self.driver.set_window_size(1920, 1080)

    def capture_page(self, path, filename, wait_for=None):
        """Capture a screenshot of a page."""
        url = f"{self.base_url}{path}"
        print(f"Capturing {url}...")
        self.driver.get(url)

        if wait_for:
            WebDriverWait(self.driver, 15).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, wait_for))
            )
        else:
            WebDriverWait(self.driver, 15).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )

        time.sleep(2)  # Let animations settle and client components hydrate

        filepath = self.output_dir / filename
        self.driver.save_screenshot(str(filepath))
        print(f"  Saved to {filepath}")

    def capture_all(self):
        """Capture all pages."""
        pages = [
            ("/", "01_landing.png", ".grid"),
            ("/pay?plan=hourly", "02_payment.png", "button"),
            ("/success?code=TEST-HOUR-0001&plan=hourly", "03_success.png", "body"),
            ("/admin", "04_admin.png", "body"),
        ]

        for path, filename, selector in pages:
            try:
                self.capture_page(path, filename, selector)
            except Exception as e:
                print(f"  Error capturing {path}: {e}")

    def cleanup(self):
        """Clean up resources."""
        if self.driver:
            self.driver.quit()
        if self.server_process:
            self.server_process.terminate()
            self.server_process.wait(timeout=5)


def main():
    generator = PreviewGenerator()
    try:
        generator.start_server()
        generator.setup_driver()
        generator.capture_all()
        print(f"\nPreviews saved to {generator.output_dir}/")
    finally:
        generator.cleanup()


if __name__ == "__main__":
    main()