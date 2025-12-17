IconForge - Generated Icons
---------------------------

Thank you for using IconForge!

INSTALLATION INSTRUCTIONS:

1. Copy Folder:
   Extract the 'favicon' folder from this ZIP and paste it directly into your project's public root directory 
   (e.g., 'public/' folder in React/Next.js/Vite, or the root folder for static HTML sites).
   
   Final structure should look like:
   /public/favicon/favicon-32x32.png
   /public/favicon/apple-touch-icon.png
   ...

2. HTML Configuration:
   Add the following links to the <head> section of your HTML pages. 
   (Note: We've updated the paths to point to the /favicon/ folder)

   <!-- Standard Favicons -->
   <link rel="icon" type="image/png" sizes="32x32" href="/favicon/favicon-32x32.png">
   <link rel="icon" type="image/png" sizes="16x16" href="/favicon/favicon-16x16.png">
   
   <!-- iOS -->
   <link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png">
   
   <!-- Android / PWA -->
   <link rel="manifest" href="/favicon/site.webmanifest">

3. Web Manifest:
   If you generate a manifest, make sure it is also placed inside the 'favicon' folder
   and that the icon paths inside 'site.webmanifest' represent the correct path (e.g. "./android-chrome-192x192.png" if in same folder).

Enjoy your new professional icons!
