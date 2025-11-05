const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class ReportGenerationService {
  /**
   * Generate assessment comparison report HTML
   */
  static async generateAssessmentComparisonReport(data) {
    const {
      school,
      learner_data,
      assessments,
      teacher_comment,
      term,
      session,
      schoolStampDataUrl,
      signatorySignatureUrl,
      signatoryRole,
      signatoryName,
      elimuriselogoDataUrl
    } = data;

    // Read the HTML template
    const templatePath = path.join(__dirname, '../views/assessment-comparison-report.ejs');
    let template;
    
    try {
      template = await fs.readFile(templatePath, 'utf8');
    } catch (error) {
      logger.warn('Template file not found, using fallback HTML');
      template = this.getFallbackTemplate();
    }

    // Replace template variables
    const html = template
      .replace(/\${school\.name}/g, school.name || '')
      .replace(/\${school\.primaryColor}/g, school.primaryColor || '#ff3333')
      .replace(/\${school\.secondaryColor}/g, school.secondaryColor || '#33cc33')
      .replace(/\${school\.school_motto}/g, school.school_motto || 'Empowering Learners for a Brighter Future')
      .replace(/\${learner_data\.first_name}/g, learner_data.first_name || '')
      .replace(/\${learner_data\.last_name}/g, learner_data.last_name || '')
      .replace(/\${learner_data\.admission_number}/g, learner_data.admission_number || '')
      .replace(/\${learner_data\.stream\.name}/g, learner_data.stream?.name || '')
      .replace(/\${learner_data\.grade\.name}/g, learner_data.grade?.name || '')
      .replace(/\${term}/g, term || '')
      .replace(/\${session}/g, session || '')
      .replace(/\${teacher_comment\.comment}/g, teacher_comment?.comment || '')
      .replace(/\${schoolStampDataUrl}/g, schoolStampDataUrl || '')
      .replace(/\${signatorySignatureUrl}/g, signatorySignatureUrl || '')
      .replace(/\${signatoryRole}/g, signatoryRole || 'Head Teacher')
      .replace(/\${signatoryName}/g, signatoryName || '')
      .replace(/\${elimuriselogoDataUrl}/g, elimuriselogoDataUrl || '');

    return html;
  }

  /**
   * Generate individual assessment report HTML
   */
  static async generateIndividualAssessmentReport(data) {
    const {
      school,
      learner_data,
      testData,
      teacher_comment,
      term,
      session,
      school_stamp,
      signatorySignatureUrl,
      signatoryRole,
      signatoryName
    } = data;

    // Read the HTML template
    const templatePath = path.join(__dirname, '../views/individual-assessment-report.ejs');
    let template;
    
    try {
      template = await fs.readFile(templatePath, 'utf8');
    } catch (error) {
      logger.warn('Template file not found, using fallback HTML');
      template = this.getFallbackTemplate();
    }

    // Replace template variables
    const html = template
      .replace(/\${school\.name}/g, school.name || '')
      .replace(/\${school\.primaryColor}/g, school.primaryColor || '#ff3333')
      .replace(/\${school\.secondaryColor}/g, school.secondaryColor || '#33cc33')
      .replace(/\${school\.school_motto}/g, school.school_motto || 'Empowering Learners for a Brighter Future')
      .replace(/\${learner_data\.first_name}/g, learner_data.first_name || '')
      .replace(/\${learner_data\.last_name}/g, learner_data.last_name || '')
      .replace(/\${learner_data\.admission_number}/g, learner_data.admission_number || '')
      .replace(/\${learner_data\.stream\.name}/g, learner_data.stream?.name || '')
      .replace(/\${learner_data\.grade\.name}/g, learner_data.grade?.name || '')
      .replace(/\${term}/g, term || '')
      .replace(/\${session}/g, session || '')
      .replace(/\${testData\.type}/g, testData?.type || '')
      .replace(/\${teacher_comment\.comment}/g, teacher_comment?.comment || '')
      .replace(/\${school_stamp}/g, school_stamp || '')
      .replace(/\${signatorySignatureUrl}/g, signatorySignatureUrl || '')
      .replace(/\${signatoryRole}/g, signatoryRole || 'Head Teacher')
      .replace(/\${signatoryName}/g, signatoryName || '');

    return html;
  }

  /**
   * Get fallback HTML template if EJS file is not found
   */
  static getFallbackTemplate() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Report - ${school?.name || 'School'}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .content { margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${school?.name || 'School Name'}</h1>
    </div>
    <div class="content">
        <p>Report content would be generated here.</p>
    </div>
    <div class="footer">
        <p>Generated on ${new Date().toLocaleDateString()}</p>
    </div>
</body>
</html>`;
  }

  /**
   * Generate PDF from HTML using wkhtmltopdf
   */
  static async generatePDF(html, options = {}) {
    const wkhtmltopdf = require('wkhtmltopdf');
    
    const defaultOptions = {
      pageSize: 'A4',
      orientation: 'Portrait',
      encoding: 'UTF-8'
    };

    const pdfOptions = { ...defaultOptions, ...options };
    
    return new Promise((resolve, reject) => {
      const chunks = [];
      const stream = wkhtmltopdf(html, pdfOptions);
      
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }
}

module.exports = ReportGenerationService; 