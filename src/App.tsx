// ============================================
// App.tsx — Routes for CivicOS
// ============================================

import { Routes, Route } from 'react-router-dom';
import SubmitReport from './pages/SubmitReport';
import StatusTracker from './pages/StatusTracker';

function App() {
  return (
    <Routes>
      <Route path="/" element={<SubmitReport />} />
      <Route path="/status/:incidentId" element={<StatusTracker />} />
    </Routes>
  );
}

export default App;
