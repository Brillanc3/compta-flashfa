// /frontend/src/pages/dashboard/StreamSourcePage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import mpegts from 'mpegts.js';
import regieService from '@/services/regieService';

const StreamSourcePage = () => {
  const { key } = useParams();
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const [isEmergency, setIsEmergency] = useState(false);
  const [loading, setLoading] = useState(true);
  const [_companyId, setCompanyId] = useState(null);

  // Poll for emergency status
  useEffect(() => {
    let interval;
    
    const checkStatus = async () => {
      try {
        const data = await regieService.getKeyStatusPublic(key);
        setIsEmergency(data.isEmergency);
        setCompanyId(data.companyId);
        setLoading(false);
      } catch (error) {
        console.error("Status check error:", error);
      }
    };

    checkStatus();
    interval = setInterval(checkStatus, 2000); // Poll every 2s

    return () => clearInterval(interval);
  }, [key]);

  // Handle Video Player
  useEffect(() => {
    if (isEmergency || !videoRef.current || !key) {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      return;
    }

    const url = `${window.location.protocol}//${window.location.host}/live-flv/live/${key}.flv`;
    
    if (mpegts.getFeatureList().mse) {
      const player = mpegts.createPlayer({
        type: 'flv',
        url: url,
        isLive: true,
        enableStashBuffer: false // Low latency
      });
      player.attachMediaElement(videoRef.current);
      player.load();
      player.play();
      playerRef.current = player;
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [key, isEmergency]);

  if (loading) return null;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden flex items-center justify-center">
      {/* Emergency Overlay */}
      {isEmergency && (
        <div className="absolute inset-0 z-50 transition-opacity duration-500 opacity-100">
           <img 
             src="/assets/emergency_bg.png" 
             alt="PROBLÈME TECHNIQUE" 
             className="w-full h-full object-cover"
           />
        </div>
      )}

      {/* Main Video Stream */}
      <video 
        ref={videoRef}
        className={`w-full h-full object-contain ${isEmergency ? 'opacity-0' : 'opacity-100'}`}
        autoPlay
        muted={false} // On veut le son dans OBS
      />
    </div>
  );
};

export default StreamSourcePage;
