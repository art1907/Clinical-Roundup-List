        // Device Detection & Adaptation
        const Device = (() => {
            const ua = navigator.userAgent.toLowerCase();
            const isIOS = /iphone|ipad|ipod/.test(ua);
            const isAndroid = /android/.test(ua);
            const isTablet = /ipad|android(?!.*mobile)/.test(ua);
            const isPhone = !isTablet;
            const width = window.innerWidth;
            const height = window.innerHeight;
            const isLandscape = width > height;
            
            return {
                isIOS,
                isAndroid,
                isTablet,
                isPhone,
                isLandscape,
                width,
                height,
                dpr: window.devicePixelRatio,
                ua,
                type: isTablet ? (isIOS ? 'iPad' : 'Android Tablet') : (isIOS ? 'iPhone' : 'Android Phone')
            };
        })();

