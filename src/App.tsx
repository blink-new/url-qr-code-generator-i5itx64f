import { QRCodeGenerator } from './components/QRCodeGenerator'
import { Toaster } from './components/ui/toaster'
import './App.css'

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            QR Code Generator
          </h1>
          <p className="text-gray-600 text-lg">
            Convert any URL into a scannable QR code instantly
          </p>
        </div>
        <QRCodeGenerator />
      </div>
      <Toaster />
    </div>
  )
}

export default App