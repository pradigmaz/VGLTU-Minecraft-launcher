import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './lib/ThemeContext';
import { LanguageProvider, useLanguage } from './lib/LanguageContext';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import UploadPage from './pages/Upload';
import FileManager from './pages/FileManager';

// Components
import Header from './components/Header';

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" />;
};

// Компонент-обертка для лейаута с хедером (только для защищенных страниц)
const Layout = ({ children }) => {
  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-background text-text dark:text-white transition-colors duration-300">
      <div className="p-8 max-w-6xl mx-auto">
        <Header onLogout={handleLogout} />
        {children}
      </div>
    </div>
  );
};

function AppContent() {
  return (
    <Routes>
      {/* Публичный роут (Логин) */}
      <Route path="/login" element={<Login />} />
      
      {/* Защищенные роуты */}
      <Route path="/" element={
        <PrivateRoute>
          <Layout><Dashboard /></Layout>
        </PrivateRoute>
      } />
      
      <Route path="/upload" element={
        <PrivateRoute>
          <Layout><UploadPage /></Layout>
        </PrivateRoute>
      } />

      <Route path="/instance/:id/files" element={
        <PrivateRoute>
          <Layout><FileManager /></Layout>
        </PrivateRoute>
      } />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <LanguageProvider>
          <AppContent />
        </LanguageProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;