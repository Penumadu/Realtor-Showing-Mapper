import React, { useState } from 'react';
import { useOptimizeRoute } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, MapPin, Map, Navigation, Clock, Trash2, ArrowRight } from 'lucide-react';
import MapView from '@/components/MapView';
import type { OptimizedRoute } from '@workspace/api-client-react';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';

interface PropertyInput {
  id: string;
  address: string;
  label: string;
}

export default function Home() {
  const { toast } = useToast();
  const [startAddress, setStartAddress] = useState('');
  const [properties, setProperties] = useState<PropertyInput[]>([
    { id: '1', address: '', label: '' },
    { id: '2', address: '', label: '' }
  ]);
  const [routeResult, setRouteResult] = useState<OptimizedRoute | null>(null);

  const optimizeRoute = useOptimizeRoute();

  const handleAddProperty = () => {
    setProperties([...properties, { id: Math.random().toString(36).substr(2, 9), address: '', label: '' }]);
  };

  const handleRemoveProperty = (id: string) => {
    if (properties.length <= 2) {
      toast({
        title: "Cannot remove",
        description: "You must have at least 2 properties to route.",
        variant: "destructive"
      });
      return;
    }
    setProperties(properties.filter(p => p.id !== id));
  };

  const handlePropertyChange = (id: string, field: 'address' | 'label', value: string) => {
    setProperties(properties.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleOptimize = () => {
    const validProperties = properties.filter(p => p.address.trim() !== '');
    if (validProperties.length < 2) {
      toast({
        title: "Missing Information",
        description: "Please enter at least 2 property addresses.",
        variant: "destructive"
      });
      return;
    }

    optimizeRoute.mutate({
      data: {
        properties: validProperties.map(p => ({
          address: p.address,
          label: p.label || undefined
        })),
        startAddress: startAddress.trim() || undefined
      }
    }, {
      onSuccess: (data) => {
        setRouteResult(data);
      },
      onError: (error) => {
        const data = error.data as { error?: string; details?: string } | null;
        const title = data?.error ?? "Optimization Failed";
        const description = data?.details?.replace(/^Error:\s*/, "") ?? error.message ?? "There was an error optimizing the route.";
        toast({
          title,
          description,
          variant: "destructive"
        });
      }
    });
  };

  const handleStartOver = () => {
    setRouteResult(null);
    setStartAddress('');
    setProperties([
      { id: '1', address: '', label: '' },
      { id: '2', address: '', label: '' }
    ]);
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Sidebar Panel */}
      <div className="w-full md:w-[450px] border-r flex flex-col h-[50vh] md:h-screen bg-card z-10 shrink-0">
        <div className="p-6 border-b shrink-0 flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg text-primary">
            <Navigation size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Showings Mapper</h1>
            <p className="text-sm text-muted-foreground">Optimal routes for agents</p>
          </div>
        </div>

        <ScrollArea className="flex-1">
          {!routeResult ? (
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="start-address">Starting Location (Optional)</Label>
                  <Input 
                    id="start-address" 
                    placeholder="e.g. Office Address, 123 Main St" 
                    value={startAddress}
                    onChange={(e) => setStartAddress(e.target.value)}
                    data-testid="input-start-address"
                  />
                  <p className="text-xs text-muted-foreground">Leave blank to start at the first property</p>
                </div>

                <div className="my-6 border-t" />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Properties to Visit</Label>
                    <Badge variant="secondary">{properties.length} stops</Badge>
                  </div>
                  
                  <div className="space-y-3">
                    {properties.map((prop, index) => (
                      <Card key={prop.id} className="relative group overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary/20 group-hover:bg-primary transition-colors" />
                        <CardContent className="p-4 pl-5">
                          <div className="flex justify-between items-start mb-2">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Stop {index + 1}
                            </Label>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 text-muted-foreground hover:text-destructive -mt-1 -mr-1"
                              onClick={() => handleRemoveProperty(prop.id)}
                              data-testid={`button-remove-prop-${prop.id}`}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                          <div className="space-y-3">
                            <Input
                              placeholder="123 Main St, City, State"
                              value={prop.address}
                              onChange={(e) => handlePropertyChange(prop.id, 'address', e.target.value)}
                              className="bg-background"
                              data-testid={`input-address-${prop.id}`}
                            />
                            <Input
                              placeholder="Nickname (e.g. 3BR Colonial) - Optional"
                              value={prop.label}
                              onChange={(e) => handlePropertyChange(prop.id, 'label', e.target.value)}
                              className="text-sm bg-background/50 h-8"
                              data-testid={`input-label-${prop.id}`}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <Button 
                    variant="outline" 
                    className="w-full border-dashed" 
                    onClick={handleAddProperty}
                    data-testid="button-add-property"
                  >
                    <Plus size={16} className="mr-2" /> Add Property
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-0">
              <div className="bg-primary text-primary-foreground p-6">
                <h2 className="text-xl font-bold mb-4">Optimized Itinerary</h2>
                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <Map size={18} className="opacity-80" />
                    <div>
                      <div className="text-xs opacity-80 uppercase tracking-wider font-medium">Distance</div>
                      <div className="font-semibold text-lg">{routeResult.totalDistanceKm.toFixed(1)} km</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={18} className="opacity-80" />
                    <div>
                      <div className="text-xs opacity-80 uppercase tracking-wider font-medium">Drive Time</div>
                      <div className="font-semibold text-lg">{formatDuration(routeResult.totalDurationMinutes)}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="relative">
                  <div className="absolute top-4 bottom-4 left-3 w-0.5 bg-border -z-10" />
                  <div className="space-y-6">
                    {routeResult.stops.map((stop, index) => {
                      const prevLeg = index > 0 ? routeResult.legs.find(l => l.to.address === stop.address) : null;
                      
                      return (
                        <div key={index} className="relative">
                          {prevLeg && (
                            <div className="ml-10 mb-4 flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded-md w-fit">
                              <ArrowRight size={14} />
                              <span className="font-medium">{formatDuration(prevLeg.durationMinutes)}</span>
                              <span className="opacity-50">•</span>
                              <span>{prevLeg.distanceKm.toFixed(1)} km</span>
                            </div>
                          )}
                          <div className="flex gap-4">
                            <div className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold ring-4 ring-background">
                              {index + 1}
                            </div>
                            <div className="flex-1 bg-card border rounded-lg p-4 shadow-sm">
                              <div className="font-semibold text-base mb-1">
                                {stop.label || `Stop ${index + 1}`}
                              </div>
                              <div className="text-sm text-muted-foreground flex items-start gap-1.5">
                                <MapPin size={14} className="mt-0.5 shrink-0 opacity-70" />
                                <span>{stop.displayName || stop.address}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </ScrollArea>

        <div className="p-6 border-t bg-card/50 shrink-0">
          {!routeResult ? (
            <Button 
              className="w-full h-12 text-base font-semibold" 
              onClick={handleOptimize}
              disabled={optimizeRoute.isPending}
              data-testid="button-optimize"
            >
              {optimizeRoute.isPending ? (
                <><Spinner className="mr-2" size="sm" /> Optimizing...</>
              ) : (
                <><Map className="mr-2" size={18} /> Optimize Route</>
              )}
            </Button>
          ) : (
            <Button 
              variant="outline"
              className="w-full h-12 text-base font-medium" 
              onClick={handleStartOver}
              data-testid="button-start-over"
            >
              Plan New Route
            </Button>
          )}
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 bg-muted relative h-[50vh] md:h-screen p-4 md:p-6">
        <div className="absolute inset-0 bg-grid-black/[0.02] bg-[size:20px_20px]" />
        {routeResult ? (
          <div className="w-full h-full rounded-2xl overflow-hidden shadow-lg border border-border/50 bg-background relative z-10">
            <MapView route={routeResult} />
          </div>
        ) : (
          <div className="w-full h-full rounded-2xl border-2 border-dashed border-border/60 bg-background/50 flex flex-col items-center justify-center text-muted-foreground p-6 text-center relative z-10">
            <div className="bg-primary/5 p-6 rounded-full mb-6">
              <Map size={48} className="text-primary/40" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Ready to Map Your Showings</h3>
            <p className="max-w-md text-balance leading-relaxed">
              Add your property addresses in the sidebar and click optimize. We'll calculate the most efficient driving route and provide an ordered itinerary.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}