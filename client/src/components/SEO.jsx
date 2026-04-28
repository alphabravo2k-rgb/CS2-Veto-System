import React, { useEffect } from 'react';

export default function SEO({ title, description }) {
    useEffect(() => {
        document.title = `${title} | VETO SaaS`;
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
            metaDesc.setAttribute('content', description || 'The most advanced competitive veto system for CS2 and beyond.');
        }
    }, [title, description]);

    return null;
}
