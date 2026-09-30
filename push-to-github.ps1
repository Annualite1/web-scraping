# Run this from inside C:\Users\HP\web-scraping

# 1. Create a .gitignore so we don't push node_modules or the raw saved
#    Canvas page (large, and contains your personal session data)
@"
node_modules/
assignments.html
Assignments_ Frontend Web Development_files/
"@ | Out-File -FilePath .gitignore -Encoding utf8

# 2. Initialize git here if it isn't already
if (-not (Test-Path .git)) {
    git init
}

# 3. Stage and commit everything
git add .
git commit -m "Add Playwright and jsdom/jQuery scrapers for ALU Canvas assignments"

# 4. Make sure the branch is named main
git branch -M main

# 5. Point this repo at your GitHub repo (removes any old one first, just in case)
git remote remove origin -ErrorAction SilentlyContinue
git remote add origin https://github.com/Annualite1/web-scraping.git

# 6. Push everything up
git push -u origin main

Write-Host "`nDone. Check https://github.com/Annualite1/web-scraping"
