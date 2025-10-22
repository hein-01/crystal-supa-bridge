const Footer = () => {
  return (
    <footer className="bg-footer-background border-t border-border py-8">
      <div className="container mx-auto px-4">
        <div className="text-center">
          {/* Company Group Info */}
          <div className="mb-6">
            <div className="mb-3">
              <h2 className="text-2xl font-bold text-primary">
                Welcome To GoLocalSG.com!
              </h2>
            </div>
            
            <p className="text-xs text-muted-foreground mb-3">
              Sister platforms offering services across Thailand and Malaysia.
            </p>
            
            {/* Service Logos */}
            <div className="flex items-center justify-center space-x-6 mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">B</span>
                </div>
                <span className="text-sm font-medium text-foreground">YaYou App</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">D</span>
                </div>
                <span className="text-sm font-medium text-foreground">BooknGet.asia</span>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
              GoLocalSG.com is your AI-powered platform and mobile app for booking services, offering your own services to earn money, discovering products, and managing your business online.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;