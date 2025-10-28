
'use client';

import { Card, CardContent } from "@/components/ui/card";

export default function StoreMapperPage() {
  return (
    <div className="h-[calc(100vh-56px)] md:h-[calc(100vh-88px)] w-full p-0 m-0">
       <iframe
          src="https://storemapper-ai-584939250419.us-west1.run.app"
          className="w-full h-full border-0"
          title="Store Mapper AI"
          allow="geolocation; microphone; camera"
        ></iframe>
    </div>
  );
}
