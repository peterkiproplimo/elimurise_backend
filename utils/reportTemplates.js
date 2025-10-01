/**
 * Generate the common header HTML for reports
 */
function generateReportHeader(school, title, term, session) {
  return `
    <div class="letterhead">
      <div class="school-info">
        <h1>${school.name || 'School Name'}</h1>
        <p>${title}</p>
        <p>Term ${term} - ${session}</p>
      </div>
    </div>
    <div class="report-title">${title}</div>
  `;
}

/**
 * Generate learner information table HTML
 */
function generateLearnerInfoTable(learner_data) {
  return `
    <div class="learner-info">
      <table>
        <tr>
          <td>Learner Name:</td>
          <td>${learner_data.first_name || ''} ${learner_data.last_name || ''}</td>
          <td>Admission No:</td>
          <td>${learner_data.admission_number || ''}</td>
        </tr>
        <tr>
          <td>Stream:</td>
          <td>${learner_data.stream?.name || ''}</td>
          <td>Grade:</td>
          <td>${learner_data.grade?.name || ''}</td>
        </tr>
      </table>
    </div>
  `;
}

/**
 * Generate comments section HTML
 */
function generateCommentsSection(teacher_comment) {
  return `
    <div class="comments">
      <div><b>Class Manager's Report:</b></div>
      <p>${teacher_comment?.comment || ''}</p>
    </div>
  `;
}

/**
 * Generate signature section HTML
 */
function generateSignatureSection(schoolStampDataUrl, signatorySignatureUrl, signatoryRole, signatoryName) {
  return `
    <div class="signature-section">
      <div class="signature-container" style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%; margin: 40px 0; padding: 0 20px;">
        <div class="signature-item" style="flex: 1; text-align: center; margin: 0 15px;">
          <div class="signature-image-container" style="margin-bottom: 15px;">
            <img src="${signatorySignatureUrl || ''}" alt="Signature" style="width: 120px; height: auto; max-height: 80px; object-fit: contain; border: 1px solid #e0e0e0; border-radius: 8px; padding: 8px; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          </div>
          <div class="signature-details" style="border-top: 2px solid var(--primary-color); padding-top: 12px;">
            <div class="signature-title" style="font-size: 0.85em; font-weight: 600; color: var(--primary-color); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">${signatoryRole || 'Head Teacher'}</div>
            <div class="signature-name" style="font-size: 1em; font-weight: 700; color: #333; margin-bottom: 2px;">${signatoryName || ''}</div>
            <div class="signature-line" style="width: 80px; height: 1px; background: var(--primary-color); margin: 8px auto 0;"></div>
          </div>
        </div>
        
        <div class="signature-divider" style="width: 2px; height: 120px; background: linear-gradient(to bottom, transparent, var(--primary-color), transparent); margin: 0 20px;"></div>
        
        <div class="stamp-item" style="flex: 1; text-align: center; margin: 0 15px;">
          <div class="stamp-image-container" style="margin-bottom: 15px;">
            <img src="${schoolStampDataUrl || ''}" alt="School Stamp" style="width: 120px; height: auto; max-height: 80px; object-fit: contain; border: 1px solid #e0e0e0; border-radius: 8px; padding: 8px; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          </div>
          <div class="stamp-details" style="border-top: 2px solid var(--primary-color); padding-top: 12px;">
            <div class="stamp-title" style="font-size: 0.85em; font-weight: 600; color: var(--primary-color); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Official Stamp</div>
            <div class="stamp-subtitle" style="font-size: 0.9em; font-weight: 500; color: #666; margin-bottom: 2px;">School Authority</div>
            <div class="stamp-line" style="width: 80px; height: 1px; background: var(--primary-color); margin: 8px auto 0;"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Generate motto section HTML
 */
function generateMottoSection(school) {
  return `
    <div class="motto" style="text-align: center; font-style: italic; margin-top: 20px;">
      ${school.school_motto || 'Empowering Learners for a Brighter Future'}
    </div>
  `;
}

/**
 * Generate common CSS styles for reports
 */
function generateCommonCSS(school) {
  const colors = {
    primaryColor: school.primaryColor || '#ff3333',
    secondaryColor: school.secondaryColor || '#33cc33',
    accent1: '#0066ff',
    accent2: '#ffcc00'
  };

  return `
    :root {
      --primary-color: ${colors.primaryColor};
      --secondary-color: ${colors.secondaryColor};
      --accent1: ${colors.accent1};
      --accent2: ${colors.accent2};
    }

    body {
      font-family: 'Comic Sans MS', cursive, sans-serif;
      background: #ffffff;
      margin: 0;
      padding: 0;
      color: #333;
      font-size: 1em;
    }

    .watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 5em;
      color: rgba(0, 0, 0, 0.1);
      z-index: -1;
    }

    .page {
      width: 90%;
      margin: 40px auto;
      background: white;
      border: 5px solid var(--primary-color);
      border-radius: 15px;
      padding: 20px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
      position: relative;
    }

    .letterhead {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 5px;
      background: var(--primary-color);
      color: white;
      border-radius: 10px 10px 0 0;
      border-bottom: 3px dashed var(--secondary-color);
      max-height: 150px;
      overflow: hidden;
      position: relative;
    }

    .school-info {
      text-align: center;
      margin-left: 10px;
      flex-grow: 1;
    }

    .school-info h1 {
      margin: 0;
      font-size: 1.8em;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
    }

    .school-info p {
      margin: 5px 0;
      font-size: 1em;
    }

    .report-title {
      text-align: center;
      margin: 20px 0;
      color: var(--primary-color);
      font-size: 1.5em;
      font-weight: bold;
    }

    .learner-info {
      background: var(--secondary-color);
      padding: 15px;
      border-radius: 10px;
      margin: 20px 0;
      color: white;
    }

    .learner-info table {
      width: 100%;
      border-collapse: collapse;
    }

    .learner-info td {
      padding: 8px;
      border: 1px solid rgba(255, 255, 255, 0.3);
    }

    .learner-info td:first-child {
      font-weight: bold;
      width: 30%;
    }

    .comments {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 10px;
      margin: 20px 0;
      border-left: 5px solid var(--accent1);
    }

    .comments div:first-child {
      font-weight: bold;
      color: var(--primary-color);
      margin-bottom: 10px;
    }

    .signature-section {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 30px 0;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 10px;
    }

    .signature {
      display: flex;
      flex-direction: row;
      align-items: center;
      width: 300px;
      margin: auto;
    }

    .signature img {
      width: 80px;
      height: 80px;
      margin: 0 10px;
      border: 2px solid var(--primary-color);
      border-radius: 10px;
    }

    .signature-label {
      text-align: center;
      font-weight: bold;
      color: var(--primary-color);
      margin-top: 10px;
    }

    .motto {
      text-align: center;
      font-style: italic;
      margin-top: 20px;
      color: var(--accent2);
      font-size: 1.1em;
    }
  `;
}

module.exports = {
  generateReportHeader,
  generateLearnerInfoTable,
  generateCommentsSection,
  generateSignatureSection,
  generateMottoSection,
  generateCommonCSS
}; 