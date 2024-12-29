from pydantic import BaseModel, ValidationError
from typing import Optional
from openai import OpenAI
import requests
import re
import json
from bs4 import BeautifulSoup
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import time
from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

# Get API key from environment variable
api_key = os.getenv('OPENAI_API_KEY')
if not api_key:
    raise ValueError("OpenAI API key not found in environment variables")

client_gpt = OpenAI(api_key=api_key)


class JobDetails(BaseModel):
    company: str
    position: str
    location: Optional[str]
    salary: Optional[str]
    description: Optional[str]  

def validate_response(response_data):
    try:
        job_details = JobDetails(**response_data)
        return job_details
    except ValidationError as e:
        print("Validation Error:", e.json())
        return None
    

system_prompt = """
You are a job parsing assistant. Your task is to extract the following fields from the given job posting HTML:

- company: The name of the company
- position: A name of the role.
- location: Where the job is located("remote" if the position is remote).
- salary: salary, if mentioned, else "not mentioned"
- description: A small summary of job-description 

Return the response strictly as a JSON object with these fields. Example format:

{
  "company": "Google",
  "position": "Data Engineer2",
  "description": "Develop and maintain software solutions.",
  "salary": "120,000 USD",
  "location": "Remote"
}

Ensure all fields are included, and if data is missing, use 'null' for the value.
"""



def completion(client_gpt, system_prompt, user_prompt):
    response = client_gpt.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
    )
    return response

def extract_main_content(html_content):
    """
    Extract main content from HTML while filtering out SVG and other non-content elements.
    
    Args:
        html_content (str): Raw HTML content
        
    Returns:
        str: Cleaned text content
    """
    # Create BeautifulSoup object
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Remove unwanted elements
    for element in soup.find_all(['svg', 'path', 'style', 'script']):
        element.decompose()
        
    # Remove empty divs and spans
    for element in soup.find_all(['div', 'span']):
        if not element.get_text(strip=True):
            element.decompose()
            
    # Function to check if element is likely navigation/header
    def is_navigation_or_header(element):
        classes = element.get('class', [])
        if not classes:
            return False
        nav_indicators = ['nav', 'header', 'menu', 'logo']
        return any(indicator in ' '.join(classes).lower() for indicator in nav_indicators)
    
    # Remove navigation and header elements
    for element in soup.find_all(is_navigation_or_header):
        element.decompose()
    
    # Get text while preserving some structure
    b = soup.find('body')
    
    
    return b



def fetch_page_body(url):
    # Set up Selenium WebDriver with headless option
    options = Options()
    options.headless = True
    driver = webdriver.Chrome(options=options)

    try:
        # Fetch the page
        driver.get(url)
        
        # Wait for a specific element to be present before extracting the body
        WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        
        # Get the page source after JavaScript has loaded
        page_source = driver.page_source
        driver.quit()
        # Parse the body content
        return extract_main_content(page_source)
    except Exception as e:
        raise Exception(f"Error fetching page: {str(e)}")



def get_parsed_jobs(job_link):
    html_content = fetch_page_body(job_link)
    
    # Pass the HTML to the model
    user_prompt = f"The following is the HTML content of a job posting page:\n\n{html_content}\n\nExtract the job details as JSON."
    ai_response = completion(client_gpt, system_prompt, user_prompt)
    try:
        parsed_data = json.loads(ai_response.choices[0].message.content)
        
        valid_data = validate_response(parsed_data)
        if valid_data:
            return valid_data.dict()
        else:
            return {"error": "Invalid response format"}
    except Exception as e:
        return {"error": str(e)}
    

