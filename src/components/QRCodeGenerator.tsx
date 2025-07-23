import { useState, useRef, useEffect, useCallback } from 'react'
import QRCode from 'qrcode'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Badge } from './ui/badge'
import { Separator } from './ui/separator'
import { Switch } from './ui/switch'
import { useToast } from '../hooks/use-toast'
import { 
  Download, 
  Copy, 
  Link, 
  QrCode, 
  Loader2, 
  Check,
  History,
  Trash2,
  Image,
  Upload,
  Globe
} from 'lucide-react'

interface RecentUrl {
  url: string
  timestamp: number
}

export function QRCodeGenerator() {
  const [url, setUrl] = useState('')
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [qrSize, setQrSize] = useState('256')
  const [recentUrls, setRecentUrls] = useState<RecentUrl[]>([])
  const [copied, setCopied] = useState(false)
  const [logoEnabled, setLogoEnabled] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string>('')
  const [autoDetectLogo, setAutoDetectLogo] = useState(true)
  const [detectedFavicon, setDetectedFavicon] = useState<string>('')
  const [isDetectingLogo, setIsDetectingLogo] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  // Load recent URLs from localStorage on component mount
  useEffect(() => {
    const saved = localStorage.getItem('qr-recent-urls')
    if (saved) {
      try {
        setRecentUrls(JSON.parse(saved))
      } catch (e) {
        console.error('Failed to parse recent URLs:', e)
      }
    }
  }, [])

  const isValidUrl = (string: string) => {
    try {
      new URL(string)
      return true
    } catch (_) {
      return false
    }
  }

  const detectFavicon = useCallback(async (urlString: string) => {
    if (!isValidUrl(urlString)) return null
    
    setIsDetectingLogo(true)
    console.log('🔍 Starting favicon detection for:', urlString)
    
    try {
      const urlObj = new URL(urlString)
      const domain = urlObj.hostname
      
      // Multiple favicon services and methods for better reliability
      const faviconSources = [
        // Google's favicon service (most reliable)
        `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
        // Alternative favicon services
        `https://icons.duckduckgo.com/ip3/${domain}.ico`,
        `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
        // Direct favicon URLs
        `${urlObj.protocol}//${domain}/favicon.ico`,
        `${urlObj.protocol}//${domain}/favicon.png`,
        `${urlObj.protocol}//${domain}/apple-touch-icon.png`
      ]
      
      console.log('🔍 Testing favicon sources:', faviconSources)
      
      for (let i = 0; i < faviconSources.length; i++) {
        const faviconUrl = faviconSources[i]
        console.log(`🔍 Testing favicon ${i + 1}/${faviconSources.length}:`, faviconUrl)
        
        try {
          // Test if favicon loads successfully
          const isAccessible = await new Promise<boolean>((resolve) => {
            const testImg = new Image()
            testImg.crossOrigin = 'anonymous'
            
            const timeoutId = setTimeout(() => {
              console.log('⏰ Favicon test timeout for:', faviconUrl)
              resolve(false)
            }, 3000)
            
            testImg.onload = () => {
              clearTimeout(timeoutId)
              console.log('✅ Favicon loaded successfully:', faviconUrl)
              resolve(true)
            }
            
            testImg.onerror = () => {
              clearTimeout(timeoutId)
              console.log('❌ Favicon failed to load:', faviconUrl)
              resolve(false)
            }
            
            testImg.src = faviconUrl
          })
          
          if (isAccessible) {
            console.log('🎉 Using favicon:', faviconUrl)
            setDetectedFavicon(faviconUrl)
            return faviconUrl
          }
        } catch (error) {
          console.log('❌ Error testing favicon:', faviconUrl, error)
          continue
        }
      }
      
      // If no favicon found, use Google's service as fallback (it usually works even if test fails)
      const fallbackFavicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
      console.log('🔄 Using fallback favicon:', fallbackFavicon)
      setDetectedFavicon(fallbackFavicon)
      return fallbackFavicon
      
    } catch (error) {
      console.error('❌ Favicon detection failed:', error)
      setDetectedFavicon('')
      return null
    } finally {
      setIsDetectingLogo(false)
    }
  }, [])

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please select an image file",
        variant: "destructive"
      })
      return
    }

    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = (e) => {
      setLogoPreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const addToRecentUrls = (newUrl: string) => {
    const updated = [
      { url: newUrl, timestamp: Date.now() },
      ...recentUrls.filter(item => item.url !== newUrl)
    ].slice(0, 5) // Keep only 5 most recent
    
    setRecentUrls(updated)
    localStorage.setItem('qr-recent-urls', JSON.stringify(updated))
  }

  const createQRWithLogo = async (qrDataUrl: string, logoUrl: string): Promise<string> => {
    console.log('🎨 Starting QR + Logo integration')
    console.log('📄 QR Data URL length:', qrDataUrl.length)
    console.log('🖼️ Logo URL:', logoUrl)
    
    try {
      // Check if canvas is supported
      if (typeof document === 'undefined' || !document.createElement) {
        throw new Error('Canvas not supported')
      }

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        throw new Error('Canvas context not available')
      }

      console.log('✅ Canvas created successfully')

      // Create QR image with better error handling
      const qrImage = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        // Don't set crossOrigin for data URLs
        if (!qrDataUrl.startsWith('data:')) {
          img.crossOrigin = 'anonymous'
        }
        
        const timeoutId = setTimeout(() => {
          console.log('⏰ QR image load timeout')
          reject(new Error('QR image load timeout'))
        }, 10000)
        
        img.onload = () => {
          clearTimeout(timeoutId)
          console.log('✅ QR image loaded:', img.width, 'x', img.height)
          resolve(img)
        }
        
        img.onerror = (e) => {
          clearTimeout(timeoutId)
          console.log('❌ QR image load error:', e)
          reject(new Error('Failed to load QR image'))
        }
        
        img.src = qrDataUrl
      })

      // Set canvas dimensions
      canvas.width = qrImage.width
      canvas.height = qrImage.height
      console.log('📐 Canvas dimensions set:', canvas.width, 'x', canvas.height)
      
      // Draw QR code
      ctx.drawImage(qrImage, 0, 0)
      console.log('✅ QR code drawn on canvas')

      // Try to load and draw logo
      try {
        console.log('🔄 Loading logo image...')
        const logoImage = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image()
          
          // Handle CORS for external images
          if (!logoUrl.startsWith('data:')) {
            img.crossOrigin = 'anonymous'
          }
          
          const timeoutId = setTimeout(() => {
            console.log('⏰ Logo load timeout for:', logoUrl)
            reject(new Error('Logo load timeout'))
          }, 8000) // Increased timeout
          
          img.onload = () => {
            clearTimeout(timeoutId)
            console.log('✅ Logo image loaded:', img.width, 'x', img.height)
            resolve(img)
          }
          
          img.onerror = (e) => {
            clearTimeout(timeoutId)
            console.log('❌ Logo load error for:', logoUrl, e)
            reject(new Error('Failed to load logo'))
          }
          
          img.src = logoUrl
        })

        // Calculate logo dimensions - make it slightly larger for better visibility
        const logoSize = Math.min(qrImage.width, qrImage.height) * 0.25
        const centerX = qrImage.width / 2
        const centerY = qrImage.height / 2
        const logoX = centerX - logoSize / 2
        const logoY = centerY - logoSize / 2
        
        console.log('📐 Logo positioning:', {
          logoSize,
          centerX,
          centerY,
          logoX,
          logoY
        })
        
        // Create white background circle for logo with border
        const backgroundRadius = logoSize / 2 + 8
        
        // Draw white background circle
        ctx.fillStyle = 'white'
        ctx.beginPath()
        ctx.arc(centerX, centerY, backgroundRadius, 0, 2 * Math.PI)
        ctx.fill()
        console.log('✅ White background circle drawn')
        
        // Add subtle border around the background
        ctx.strokeStyle = '#e5e7eb'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(centerX, centerY, backgroundRadius, 0, 2 * Math.PI)
        ctx.stroke()
        console.log('✅ Border drawn')
        
        // Draw logo with circular clipping for perfect centering
        ctx.save()
        ctx.beginPath()
        ctx.arc(centerX, centerY, logoSize / 2, 0, 2 * Math.PI)
        ctx.clip()
        
        // Draw the logo perfectly centered
        ctx.drawImage(logoImage, logoX, logoY, logoSize, logoSize)
        ctx.restore()
        console.log('✅ Logo drawn and clipped')
        
      } catch (logoError) {
        console.warn('⚠️ Logo integration failed, using QR without logo:', logoError)
        // Continue without logo if logo loading fails
      }

      const finalDataUrl = canvas.toDataURL('image/png')
      console.log('🎉 Final QR with logo created, data URL length:', finalDataUrl.length)
      return finalDataUrl
      
    } catch (error) {
      console.error('❌ Canvas QR creation failed:', error)
      // Return original QR code if canvas operations fail
      return qrDataUrl
    }
  }

  const generateQRCode = async (inputUrl?: string) => {
    const targetUrl = inputUrl || url
    
    if (!targetUrl.trim()) {
      toast({
        title: "URL Required",
        description: "Please enter a URL to generate QR code",
        variant: "destructive"
      })
      return
    }

    if (!isValidUrl(targetUrl)) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid URL (e.g., https://example.com)",
        variant: "destructive"
      })
      return
    }

    setIsGenerating(true)
    
    try {
      // Generate base QR code
      const qrDataUrl = await QRCode.toDataURL(targetUrl, {
        width: parseInt(qrSize),
        margin: 2,
        color: {
          dark: '#1f2937',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'H' // High error correction for better logo compatibility
      })
      
      let finalQrDataUrl = qrDataUrl

      // Add logo if enabled
      if (logoEnabled) {
        console.log('🖼️ Logo integration enabled')
        let logoUrl = ''
        
        if (logoFile && logoPreview) {
          console.log('📁 Using uploaded logo file')
          logoUrl = logoPreview
        } else if (autoDetectLogo) {
          console.log('🔍 Auto-detecting favicon for:', targetUrl)
          const favicon = await detectFavicon(targetUrl)
          if (favicon) {
            console.log('✅ Favicon detected:', favicon)
            logoUrl = favicon
          } else {
            console.log('❌ No favicon detected')
          }
        }
        
        if (logoUrl) {
          console.log('🎨 Proceeding with logo integration using:', logoUrl)
          try {
            finalQrDataUrl = await createQRWithLogo(qrDataUrl, logoUrl)
            // Check if logo integration actually worked by comparing data URLs
            if (finalQrDataUrl === qrDataUrl) {
              console.warn('⚠️ Logo integration returned original QR code - no changes made')
              toast({
                title: "Logo Integration Issue",
                description: "Logo could not be integrated, using QR code without logo",
                variant: "destructive"
              })
            } else {
              console.log('🎉 Logo integration successful!')
              toast({
                title: "Success!",
                description: "QR code with logo generated successfully"
              })
            }
          } catch (error) {
            console.error('❌ Logo integration failed:', error)
            // Use QR code without logo if logo integration fails
            finalQrDataUrl = qrDataUrl
            toast({
              title: "Logo Integration Failed",
              description: "QR code generated without logo",
              variant: "destructive"
            })
          }
        } else {
          console.log('⚠️ No logo URL available for integration')
          toast({
            title: "No Logo Found",
            description: "Could not detect or load logo, generating QR code without logo",
            variant: "destructive"
          })
        }
      }
      
      setQrCodeDataUrl(finalQrDataUrl)
      if (!inputUrl) {
        addToRecentUrls(targetUrl)
      }
      
      toast({
        title: "QR Code Generated!",
        description: logoEnabled ? "QR code with logo is ready!" : "Your QR code is ready to download or share"
      })
    } catch (error) {
      console.error('QR generation error:', error)
      toast({
        title: "Generation Failed",
        description: "Failed to generate QR code. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const downloadQRCode = () => {
    if (!qrCodeDataUrl) return
    
    const link = document.createElement('a')
    link.download = `qr-code-${logoEnabled ? 'with-logo-' : ''}${Date.now()}.png`
    link.href = qrCodeDataUrl
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    toast({
      title: "Downloaded!",
      description: "QR code saved to your device"
    })
  }

  const copyToClipboard = async () => {
    if (!qrCodeDataUrl) return
    
    try {
      const response = await fetch(qrCodeDataUrl)
      const blob = await response.blob()
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ])
      
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      
      toast({
        title: "Copied!",
        description: "QR code copied to clipboard"
      })
    } catch (error) {
      console.error('Copy failed:', error)
      toast({
        title: "Copy Failed",
        description: "Unable to copy QR code to clipboard",
        variant: "destructive"
      })
    }
  }

  const clearRecentUrls = () => {
    setRecentUrls([])
    localStorage.removeItem('qr-recent-urls')
    toast({
      title: "History Cleared",
      description: "Recent URLs have been cleared"
    })
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      generateQRCode()
    }
  }

  // Auto-detect favicon when URL changes and auto-detect is enabled
  useEffect(() => {
    if (autoDetectLogo && logoEnabled && url && isValidUrl(url)) {
      detectFavicon(url)
    }
  }, [url, autoDetectLogo, logoEnabled, detectFavicon])

  return (
    <div className="max-w-md mx-auto space-y-6">
      {/* Main Generator Card */}
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="text-center pb-4">
          <CardTitle className="flex items-center justify-center gap-2 text-xl">
            <QrCode className="w-6 h-6 text-blue-600" />
            Generate QR Code
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* URL Input */}
          <div className="space-y-2">
            <div className="relative">
              <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="url"
                placeholder="Enter URL (e.g., https://example.com)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10 h-12 text-base"
                disabled={isGenerating}
              />
            </div>
          </div>

          {/* Logo Options */}
          <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Image className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Add Logo</span>
              </div>
              <Switch
                checked={logoEnabled}
                onCheckedChange={setLogoEnabled}
              />
            </div>
            
            {logoEnabled && (
              <div className="space-y-3">
                {/* Auto-detect toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-gray-500" />
                    <span className="text-xs text-gray-600">Auto-detect website logo</span>
                  </div>
                  <Switch
                    checked={autoDetectLogo}
                    onCheckedChange={setAutoDetectLogo}
                  />
                </div>

                {/* Detected favicon preview */}
                {autoDetectLogo && detectedFavicon && (
                  <div className="flex items-center gap-2 p-2 bg-white rounded border">
                    <img 
                      src={detectedFavicon} 
                      alt="Detected logo" 
                      className="w-6 h-6 rounded"
                      onError={() => setDetectedFavicon('')}
                    />
                    <span className="text-xs text-gray-600">Auto-detected logo</span>
                    {isDetectingLogo && <Loader2 className="w-3 h-3 animate-spin" />}
                  </div>
                )}

                {/* Manual upload */}
                {!autoDetectLogo && (
                  <div className="space-y-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Logo
                    </Button>
                    
                    {logoPreview && (
                      <div className="flex items-center gap-2 p-2 bg-white rounded border">
                        <img src={logoPreview} alt="Logo preview" className="w-6 h-6 rounded" />
                        <span className="text-xs text-gray-600">Custom logo selected</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Size Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">QR Code Size</label>
            <Select value={qrSize} onValueChange={setQrSize}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="128">Small (128px)</SelectItem>
                <SelectItem value="256">Medium (256px)</SelectItem>
                <SelectItem value="512">Large (512px)</SelectItem>
                <SelectItem value="1024">Extra Large (1024px)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Generate Button */}
          <Button 
            onClick={() => generateQRCode()}
            disabled={isGenerating || !url.trim()}
            className="w-full h-12 text-base font-medium bg-blue-600 hover:bg-blue-700"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <QrCode className="w-4 h-4 mr-2" />
                Generate QR Code {logoEnabled && '+ Logo'}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* QR Code Display */}
      {qrCodeDataUrl && (
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <div className="bg-white p-4 rounded-lg shadow-inner inline-block">
                <img 
                  src={qrCodeDataUrl} 
                  alt="Generated QR Code"
                  className="mx-auto"
                  style={{ maxWidth: '100%', height: 'auto' }}
                />
              </div>
              
              {logoEnabled && (
                <Badge variant="secondary" className="text-xs">
                  <Image className="w-3 h-3 mr-1" />
                  QR Code with Logo
                </Badge>
              )}
              
              {/* Action Buttons */}
              <div className="flex gap-2 justify-center">
                <Button
                  onClick={downloadQRCode}
                  variant="outline"
                  size="sm"
                  className="flex-1 max-w-32"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download
                </Button>
                <Button
                  onClick={copyToClipboard}
                  variant="outline"
                  size="sm"
                  className="flex-1 max-w-32"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-1 text-green-600" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent URLs */}
      {recentUrls.length > 0 && (
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <History className="w-5 h-5 text-gray-600" />
                Recent URLs
              </CardTitle>
              <Button
                onClick={clearRecentUrls}
                variant="ghost"
                size="sm"
                className="text-gray-500 hover:text-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {recentUrls.map((item, index) => (
                <div key={index}>
                  <button
                    onClick={() => {
                      setUrl(item.url)
                      generateQRCode(item.url)
                    }}
                    className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600">
                          {item.url}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(item.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                      <QrCode className="w-4 h-4 text-gray-400 group-hover:text-blue-600 ml-2 flex-shrink-0" />
                    </div>
                  </button>
                  {index < recentUrls.length - 1 && <Separator className="mt-2" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}