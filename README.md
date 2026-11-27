
# AgriNexus — AI-Powered Post-Harvest Decision Intelligence Platform

<p align="center">
  <strong>Reducing Post-Harvest Losses Through Intelligent, Data-Driven Decisions</strong>
</p>

<p align="center">
  <a href="https://agrinexusdemo.netlify.app/">Live Demo</a> •
  <a href="https://github.com/Vedantvijayvargiya-06/AGRINEXUS">GitHub Repository</a>
</p>

---

## 🌱 Overview

AgriNexus is an AI-powered agricultural decision-support platform designed to help farmers, Farmer Producer Organizations (FPOs), and agricultural stakeholders make smarter post-harvest decisions.

The platform combines produce degradation modelling, economic decision optimization, mandi market intelligence, freight cluster pooling, and bilingual assistance into one integrated web application.

AgriNexus aims to reduce post-harvest losses, improve logistics coordination, and support better economic outcomes through data-driven recommendations.

## 🚀 Key Features

### 1. Post-Harvest Degradation Intelligence
- Q10-based continuous degradation modelling.
- Crop-related kinetic parameters for degradation estimation.
- Farmer batch management and tracking.
- Time-based produce deterioration analysis.

### 2. Economic Decision Optimization
- Four-pathway economic decision optimization.
- Comparison of available post-harvest decision pathways.
- Recommendations based on configured economic inputs.
- Recalculation of active batch recommendations after authorized market-rate updates.

### 3. FPO Freight Cluster Pooling
- Freight cluster management.
- Produce transportation coordination.
- Cluster confirmation workflows.
- Support for logistics optimization.

### 4. Mandi Market Intelligence
- Mandi market information dashboard.
- Demo Feed identification for seeded market rates.
- FPO Override functionality for authorized market-rate updates.
- SQLite persistence for submitted overrides.
- Updated recommendations based on market-rate changes.

### 5. Bilingual Assistance
- English and Hindi user-facing assistance.
- AI-assisted agricultural information.
- Context-based responses through the backend assistance service.

### 6. Authentication & Security
- JWT-based authentication.
- Role-Based Access Control (RBAC).
- PBKDF2-SHA256 password hashing with salt.
- OTP-related security workflows.
- Protected API endpoints and rate-limit handling.

### 7. Reports & Notifications
- Application reporting workflows.
- Notification management.
- Persistent application records.
- Backend-supported reporting services.

---

## 🛠️ Technology Stack

| Category | Technologies |
|---|---|
| Frontend | React 18, Vite 6 |
| Styling | Tailwind CSS 3 |
| Icons | Lucide React |
| Backend | Node.js, Express.js |
| Database | SQLite |
| Database Mode | Write-Ahead Logging (WAL) |
| Authentication | JSON Web Tokens |
| Password Security | PBKDF2-SHA256 |
| Voice Interface | Web Speech API |
| Testing | Node.js Test Runner |
| E2E Testing | Playwright |
| Frontend Deployment | Netlify |
| Backend Deployment | Render |

---

## 🏗️ Application Architecture

AgriNexus follows a frontend-backend architecture.

```text
                  AGRINEXUS PLATFORM
                          |
             +------------+------------+
             |                         |
        React Frontend             Express Backend
             |                         |
          Netlify               +------+------+
                                |      |      |
                              Routes Services Security
                                       |
                         +-------------+-------------+
                         |             |             |
                      Q10 Model   Optimization   Market Feed
                         |             |             |
                         +-------------+-------------+
                                       |
                                  SQLite Database
```

### Architecture Components

- **Frontend:** React-based responsive user interface.
- **Backend:** Express.js API handling application logic and requests.
- **Service Layer:** Contains degradation, optimization, market, cluster, and assistance services.
- **Database:** SQLite for persistent application data.
- **Security Layer:** JWT authentication and role-based authorization.
- **Deployment:** Netlify frontend with Render backend.

---

## 📂 Project Structure

```text
AGRINEXUS/
│
├── server.js
│
├── server/
│   ├── config.js
│   ├── store.js
│   ├── security.js
│   ├── routes/
│   ├── services/
│   └── tests/
│       └── agrinexus.test.js
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   └── application files
│   │
│   └── e2e_test.cjs
│
├── netlify.toml
├── package.json
├── package-lock.json
└── .env.example
```

---

## 💻 Getting Started

Follow these steps to run AgriNexus locally.

### Prerequisites

Make sure you have installed:

- Node.js 22 or later
- npm
- Git

Check versions:

```bash
node --version
npm --version
```

### 1. Clone the Repository

```bash
git clone https://github.com/Vedantvijayvargiya-06/AGRINEXUS.git
```

### 2. Navigate to Project Directory

```bash
cd AGRINEXUS
```

### 3. Install Dependencies

```bash
npm ci
```

### 4. Configure Environment Variables

Copy the example environment file.

**Windows PowerShell:**

```powershell
Copy-Item .env.example .env
```

**Linux / macOS:**

```bash
cp .env.example .env
```

Configure the required values inside `.env`.

### 5. Build the Frontend

```bash
npm run build
```

### 6. Start the Application

```bash
npm run dev
```

Open your browser:

```text
http://localhost:3000
```

---

## ⚙️ Environment Configuration

The application uses environment variables for configuration.

| Variable | Description |
|---|---|
| PORT | Backend server port |
| DATABASE_PATH | SQLite database location |
| JWT_SECRET_KEY | JWT signing secret |
| CORS_ALLOWED_ORIGINS | Allowed frontend origins |
| DEMO_MODE | Enables demo-specific behavior |
| ADMIN_BOOTSTRAP_PASSWORD | Optional initial administrator password |

Example local configuration:

```env
PORT=3000
DATABASE_PATH=./data/agrinexus.db
JWT_SECRET_KEY=your-long-random-secret-key-of-at-least-32-characters
CORS_ALLOWED_ORIGINS=http://localhost:3000
DEMO_MODE=true
```

**Security Recommendations:**

- Never upload `.env` files containing actual secrets to GitHub.
- Use a strong JWT secret in production.
- Set `DEMO_MODE=false` in production.
- Configure CORS with trusted frontend origins only.
- Use a secure administrator bootstrap password.

---

## 🧪 Testing

AgriNexus includes automated backend and end-to-end testing support.

### Backend Tests

```bash
npm test
```

### Syntax Checks

```bash
npm run lint
```

### Production Build

```bash
npm run build
```

### End-to-End Testing

First, start the application:

```bash
npm run dev
```

Then execute the E2E tests in another terminal.

**Windows PowerShell:**

```powershell
$env:E2E_BASE_URL="http://127.0.0.1:3000"
npm run test:e2e
```

**Linux / macOS:**

```bash
E2E_BASE_URL=http://127.0.0.1:3000 npm run test:e2e
```

The E2E suite uses Playwright with Chromium and includes browser and mobile viewport checks.

---

## ☁️ Deployment

AgriNexus uses Netlify for frontend hosting and Render for backend hosting.

### Backend Deployment — Render

1. Create a new Web Service on Render.
2. Connect the AGRINEXUS GitHub repository.
3. Configure the build command:

```bash
npm ci && npm run build
```

4. Configure the start command:

```bash
npm start
```

5. Configure a persistent disk for SQLite data.
6. Mount the disk at `/var/data`.
7. Configure production environment variables.

Example:

```env
NODE_ENV=production
DEMO_MODE=false
DATABASE_PATH=/var/data/agrinexus.db
JWT_SECRET_KEY=your-production-secret
CORS_ALLOWED_ORIGINS=https://agrinexusdemo.netlify.app
```

### Frontend Deployment — Netlify

1. Connect the GitHub repository to Netlify.
2. Configure the build command:

```bash
npm install --include=dev && npm run build
```

3. Set the publish directory:

```text
frontend/dist
```

4. Configure the API proxy through `netlify.toml`.
5. Verify that the API proxy points to the correct Render backend URL.
6. Deploy the application.

---

## 🔐 Data Security & Persistence

AgriNexus incorporates several security and data management mechanisms:

- JWT-based authentication for protected workflows.
- Salted PBKDF2-SHA256 password hashing.
- Role-Based Access Control for administrative operations.
- SQLite database persistence.
- Write-Ahead Logging (WAL) configuration.
- Environment-based secret management.
- Demo Feed and FPO Override identification for market information.

---

## ⚠️ Important Notes

- Seeded mandi rates marked as `Demo Feed` are illustrative data, not verified real-time market prices.
- Market recommendations depend on the available input data and configured model parameters.
- Voice functionality depends on browser support for the Web Speech API.
- AI-generated assistance and optimization outputs should support informed decisions, not replace professional agricultural advice.
- Production database persistence requires correctly configured durable storage.

---

## 🔮 Future Scope

Potential future improvements include:

- Integration with verified live mandi market APIs.
- Advanced crop degradation prediction models.
- IoT-based environmental monitoring.
- Weather-aware post-harvest recommendations.
- Enhanced logistics and transportation optimization.
- Advanced analytics and farmer performance dashboards.
- Mobile-first agricultural decision-support capabilities.

---

## 🤝 Contributing

Contributions, suggestions, and bug reports are welcome.

1. Fork the repository.
2. Create a feature branch.

```bash
git checkout -b feature/your-feature-name
```

3. Implement your changes.
4. Run the tests.

```bash
npm run lint
npm test
npm run build
```

5. Commit your changes.

```bash
git commit -m "Add your feature"
```

6. Push your branch and create a Pull Request.

---

## 🌐 Project Links

| Resource | Link |
|---|---|
| Live Application | https://agrinexusdemo.netlify.app/ |
| GitHub Repository | https://github.com/Vedantvijayvargiya-06/AGRINEXUS |

---

## 📄 License

No open-source license has been specified in this repository. Add a LICENSE file if you intend to distribute the project under an open-source license.

---

<p align="center">
  <strong>AgriNexus</strong>
  <br />
  Smarter Decisions. Better Agriculture. Reduced Post-Harvest Losses.
</p>
