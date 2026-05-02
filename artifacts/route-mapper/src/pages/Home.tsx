import { useState, useEffect } from 'react';
import { useOptimizeRoute, useShareRoute, useGetSharedRoute } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, MapPin, Map, Navigation, Clock, Trash2, ArrowRight, Share2, MessageSquare, Mail, Copy, Check } from 'lucide-react';
import MapView from '@/components/MapView';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import type { OptimizedRoute } from '@workspace/api-client-react';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';

const SHOWING_DURATION_MIN = 30;

interface PropertyInput {
  id: string;
  address: string;
  label: string;
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function addMinutesToTime(base: number, add: number): string {
  const total = base + add;
  const h = Math.floor(total / 60) % 24;
  const m = Math.round(total % 60);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
}

export default function Home() {
  const { toast } = useToast();
  const [startAddress, setStartAddress] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [properties, setProperties] = useState<PropertyInput[]>([
    { id: '1', address: '', label: '' },
    { id: '2', address: '', label: '' }
  ]);
  const [routeResult, setRouteResult] = useState<OptimizedRoute | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [copied, setCopied] = useState(false);
  const [loadingShare, setLoadingShare] = useState(false);

  // Check for ?share=ID on load
  const urlShareId = new URLSearchParams(window.location.search).get('share');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sharedRouteQuery = useGetSharedRoute(urlShareId ?? '', {
    query: { enabled: !!urlShareId && !routeResult } as any
  });

  useEffect(() => {
    if (sharedRouteQuery.data) {
      setRouteResult(sharedRouteQuery.data as OptimizedRoute);
    }
  }, [sharedRouteQuery.data]);

  const optimizeRoute = useOptimizeRoute();
  const shareRouteMutation = useShareRoute();

  const handleAddProperty = () => {
    setProperties([...properties, { id: Math.random().toString(36).substr(2, 9), address: '', label: '' }]);
  };

  const handleRemoveProperty = (id: string) => {
    if (properties.length <= 2) {
      toast({ title: "Cannot remove", description: "You must have at least 2 properties to route.", variant: "destructive" });
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
      toast({ title: "Missing Information", description: "Please enter at least 2 property addresses.", variant: "destructive" });
      return;
    }
    optimizeRoute.mutate({
      data: {
        properties: validProperties.map(p => ({ address: p.address, label: p.label || undefined })),
        startAddress: startAddress.trim() || undefined
      }
    }, {
      onSuccess: (data) => {
        setRouteResult(data);
        setShareId(null);
        setShareUrl('');
      },
      onError: (error) => {
        const data = error.data as { error?: string; details?: string } | null;
        const title = data?.error ?? "Optimization Failed";
        const description = data?.details?.replace(/^Error:\s*/, "") ?? error.message ?? "There was an error optimizing the route.";
        toast({ title, description, variant: "destructive" });
      }
    });
  };

  const handleStartOver = () => {
    setRouteResult(null);
    setStartAddress('');
    setStartTime('09:00');
    setShareId(null);
    setShareUrl('');
    setPhone('');
    setProperties([{ id: '1', address: '', label: '' }, { id: '2', address: '', label: '' }]);
    // Clear share param from URL without reload
    window.history.replaceState({}, '', window.location.pathname);
  };

  const handleShare = () => {
    if (!routeResult) return;
    setLoadingShare(true);
    shareRouteMutation.mutate({
      data: { route: routeResult as any, startTime }
    }, {
      onSuccess: (data) => {
        setShareId(data.shareId);
        setShareUrl(data.shareUrl);
        setLoadingShare(false);
      },
      onError: () => {
        toast({ title: "Share failed", description: "Could not generate share link.", variant: "destructive" });
        setLoadingShare(false);
      }
    });
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendSms = () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      toast({ title: "Invalid number", description: "Please enter a valid mobile number.", variant: "destructive" });
      return;
    }
    const msg = encodeURIComponent(`Hi! Here's your showing route: ${shareUrl}`);
    window.open(`sms:+${digits}?body=${msg}`, '_blank');
  };

  const handleSendEmail = () => {
    if (!email.trim() || !email.includes('@')) {
      toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    const stopList = routeResult?.stops
      .map((s, i) => `  ${i + 1}. ${s.label || s.displayName || s.address}  →  Arrive ${arrivalTimes[i]}, leave ~${departureTimes[i]}`)
      .join('\n') ?? '';
    const subject = encodeURIComponent('Your Property Showing Schedule');
    const body = encodeURIComponent(
      `Hi,\n\nHere is your optimised showing schedule:\n\n${stopList}\n\nView the full route on the map:\n${shareUrl}\n\nHave a great day!`
    );
    window.open(`mailto:${encodeURIComponent(email.trim())}?subject=${subject}&body=${body}`, '_blank');
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  // Precompute arrival and departure times for each stop
  const { arrivalTimes, departureTimes } = (() => {
    if (!routeResult) return { arrivalTimes: [] as string[], departureTimes: [] as string[] };
    const baseMin = parseTimeToMinutes(startTime);
    const arrivals: string[] = [];
    const departures: string[] = [];
    let cursor = baseMin;
    routeResult.stops.forEach((stop, index) => {
      if (index > 0) {
        const leg = routeResult.legs.find(l => l.to.address === stop.address);
        cursor += (leg?.durationMinutes ?? 0) + SHOWING_DURATION_MIN;
      }
      arrivals.push(addMinutesToTime(cursor, 0));
      departures.push(addMinutesToTime(cursor, SHOWING_DURATION_MIN));
    });
    return { arrivalTimes: arrivals, departureTimes: departures };
  })();

  if (urlShareId && sharedRouteQuery.isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <Spinner className="size-8" />
          <p className="text-sm">Loading shared route…</p>
        </div>
      </div>
    );
  }

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
                {/* Start Location */}
                <div className="space-y-2">
                  <Label htmlFor="start-address">Starting Location (Optional)</Label>
                  <AddressAutocomplete
                    value={startAddress}
                    onChange={setStartAddress}
                    placeholder="e.g. Office Address, 123 Main St"
                    data-testid="input-start-address"
                  />
                  <p className="text-xs text-muted-foreground">Leave blank to start at the first property</p>
                </div>

                {/* Start Time */}
                <div className="space-y-2">
                  <Label htmlFor="start-time">Start Time</Label>
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-muted-foreground shrink-0" />
                    <input
                      id="start-time"
                      type="time"
                      value={startTime}
                      onChange={e => setStartTime(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Route times assume 30 min per showing</p>
                </div>

                <div className="my-2 border-t" />

                {/* Properties */}
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
                            <AddressAutocomplete
                              value={prop.address}
                              onChange={(v) => handlePropertyChange(prop.id, 'address', v)}
                              placeholder="123 Main St, City, State"
                              className="bg-background"
                              data-testid={`input-address-${prop.id}`}
                            />
                            <input
                              placeholder="Nickname (e.g. 3BR Colonial) - Optional"
                              value={prop.label}
                              onChange={(e) => handlePropertyChange(prop.id, 'label', e.target.value)}
                              className="flex h-8 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
              {/* Summary header */}
              <div className="bg-primary text-primary-foreground p-6">
                <h2 className="text-xl font-bold mb-1">Optimized Itinerary</h2>
                <p className="text-sm opacity-75 mb-4">Starting at {addMinutesToTime(parseTimeToMinutes(startTime), 0)} · 30 min per showing</p>
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
                      <div className="text-xs opacity-80 uppercase tracking-wider font-medium">Total Time</div>
                      <div className="font-semibold text-lg">
                        {formatDuration(routeResult.totalDurationMinutes + routeResult.stops.length * SHOWING_DURATION_MIN)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Itinerary */}
              <div className="p-6 space-y-6">
                <div className="relative">
                  <div className="absolute top-4 bottom-4 left-3 w-0.5 bg-border -z-10" />
                  <div className="space-y-6">
                    {routeResult.stops.map((stop, index) => {
                      const prevLeg = index > 0 ? routeResult.legs.find(l => l.to.address === stop.address) : null;
                      const arrival = arrivalTimes[index];

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
                              {/* Arrival time badge */}
                              <div className="flex items-center justify-between mb-1">
                                <div className="font-semibold text-base">
                                  {stop.label || `Stop ${index + 1}`}
                                </div>
                                <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Clock size={10} />
                                  {arrival}
                                </span>
                              </div>
                              <div className="text-sm text-muted-foreground flex items-start gap-1.5 mb-2">
                                <MapPin size={14} className="mt-0.5 shrink-0 opacity-70" />
                                <span>{stop.displayName || stop.address}</span>
                              </div>
                              <div className="text-xs text-muted-foreground border-t pt-2 mt-2 flex items-center gap-1">
                                <Clock size={11} className="opacity-60" />
                                <span>Showing until ~{departureTimes[index]}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Share panel */}
                <div className="border rounded-xl p-4 space-y-3 bg-muted/30">
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <Share2 size={15} className="text-primary" />
                    Share This Route
                  </div>

                  {!shareUrl ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleShare}
                      disabled={loadingShare}
                    >
                      {loadingShare ? <><Spinner className="mr-2 size-3" />Generating link…</> : <><Share2 size={14} className="mr-2" />Generate Share Link</>}
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      {/* Copy link row */}
                      <div className="flex gap-2">
                        <input
                          readOnly
                          value={shareUrl}
                          className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-xs text-muted-foreground truncate"
                        />
                        <Button size="sm" variant="outline" onClick={handleCopy} className="shrink-0 w-9 p-0">
                          {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                        </Button>
                      </div>

                      {/* SMS row */}
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <MessageSquare size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <input
                            type="tel"
                            placeholder="Mobile number"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          />
                        </div>
                        <Button size="sm" onClick={handleSendSms} className="shrink-0">
                          Send SMS
                        </Button>
                      </div>

                      {/* Email row */}
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <input
                            type="email"
                            placeholder="Email address"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          />
                        </div>
                        <Button size="sm" variant="outline" onClick={handleSendEmail} className="shrink-0">
                          Send Email
                        </Button>
                      </div>

                      <p className="text-xs text-muted-foreground">Opens your SMS or email app with the schedule pre-filled</p>
                    </div>
                  )}
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
                <><Spinner className="mr-2 size-4" /> Optimizing…</>
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
