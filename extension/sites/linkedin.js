const LinkedInScraper = {
    isJobPage() {
        const path = window.location.pathname;
        return path.startsWith("/jobs/view/") ||
               path.startsWith("/jobs/collections/") ||
               path.startsWith("/jobs/search-results/");
      },

      scrape() {
        if (!this.isJobPage()) return null;
      
        const title = this._text(".job-details-jobs-unified-top-card__job-title h1") ||
                      this._titleFromPageTitle();
      
        const company = this._text(".job-details-jobs-unified-top-card__company-name") ||
                        this._companyFromPageTitle();
      
        return {
          title,
          company,
          location: this._text(".job-details-jobs-unified-top-card__primary-description-container .tvm__text"),
          salary:   this._text(".job-details-jobs-unified-top-card__job-insight--highlight span") ?? "",
          contact:  "",
          description: this._text("#job-details"),
        };
      },
      
      _titleFromPageTitle() {
        // "Quantitative Analyst Internship in Gurgaon | Galytix | LinkedIn"
        return document.title.split(" | ")[0].trim();
      },
      
      _companyFromPageTitle() {
        const parts = document.title.split(" | ");
        return parts.length >= 2 ? parts[1].trim() : "";
      },
      
      _text(selector) {
        const el = document.querySelector(selector);
        return el ? el.innerText.trim() : "";
      },
  
    _text(selector) {
      const el = document.querySelector(selector);
      return el ? el.innerText.trim() : "";
    },
  };