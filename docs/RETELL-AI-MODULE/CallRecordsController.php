<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Services\RetellAIService;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use App\Traits\CacheTrait;

class CallRecordsController extends Controller
{
    use CacheTrait;
    
    protected $retellService;
    public $search = '';
    public $sortField = 'start_timestamp';
    public $sortDirection = 'desc';
    public $perPage = 10;
    public $showDeleted = false;

    public function __construct(RetellAIService $retellService)
    {
        $this->retellService = $retellService;
    }

    public function index()
    {
        return view('call-records.index');
    }

    public function getCalls(Request $request)
    {
        try {
            // Set up cache and search parameters
            $this->search = $request->input('search', '');
            $this->sortField = $request->input('sort_field', 'start_timestamp');
            $this->sortDirection = $request->input('sort_direction', 'desc');
            $this->perPage = $request->input('per_page', 10);
            
            $page = $request->input('page', 1);
            // Include filters in cache key to ensure unique caches for different filters
            $cacheParams = [
                'page' => $page,
                'search' => $this->search,
                'sort' => $this->sortField . '-' . $this->sortDirection,
                'per_page' => $this->perPage
            ];
            
            // Add date filters to cache params if they exist
            if ($request->has('start_date') && !empty($request->start_date) && 
                $request->has('end_date') && !empty($request->end_date)) {
                $cacheParams['date_range'] = $request->start_date . '_to_' . $request->end_date;
            }
            
            $cacheKey = $this->generateCacheKey('call_records', json_encode($cacheParams));
            
            // Use cache to improve performance
            $response = Cache::remember($cacheKey, 15, function() use ($request, $page) {
                return $this->fetchCallData($request, $page);
            });
            
            return response()->json($response);
            
        } catch (\Exception $e) {
            Log::error('Error loading calls', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'error' => 'Error loading calls: ' . $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Fetch call data from API and process it
     */
    private function fetchCallData(Request $request, $page)
    {
        $filters = [];
        
        // Apply date filters if provided
        if ($request->has('start_date') && !empty($request->start_date) && 
            $request->has('end_date') && !empty($request->end_date)) {
            
            $startDate = $request->start_date;
            $endDate = $request->end_date;
            
            // Validate that end date isn't before start date
            if (strtotime($endDate) < strtotime($startDate)) {
                throw new \InvalidArgumentException('End date cannot be before start date');
            }
            
            // Validate that dates aren't in the future
            $today = Carbon::now()->startOfDay();
            if (Carbon::parse($startDate)->startOfDay()->greaterThan($today) ||
                Carbon::parse($endDate)->startOfDay()->greaterThan($today)) {
                throw new \InvalidArgumentException('Dates cannot be in the future');
            }
            
            // Convert to milliseconds for Retell API
            $startTimestamp = Carbon::parse($startDate)->startOfDay()->timestamp * 1000;
            $endTimestamp = Carbon::parse($endDate)->endOfDay()->timestamp * 1000;
            
            Log::info('Date filter applied', [
                'start_date' => $startDate,
                'end_date' => $endDate,
                'start_timestamp' => $startTimestamp,
                'end_timestamp' => $endTimestamp
            ]);
            
            $filters['time_range'] = [
                'start_timestamp' => $startTimestamp,
                'end_timestamp' => $endTimestamp
            ];
        }
        
        // Get calls from service
        Log::info('Fetching calls with filters', ['filters' => $filters]);
        $calls = $this->retellService->listCalls($filters);
        Log::info('Retrieved calls', ['count' => count($calls)]);
        
        // Filtro de fechas en PHP para asegurar que funcione correctamente
        if (isset($filters['time_range'])) {
            $start = $filters['time_range']['start_timestamp'];
            $end = $filters['time_range']['end_timestamp'];
            $calls = collect($calls)->filter(function ($call) use ($start, $end) {
                $ts = $call['start_timestamp'] ?? 0;
                return $ts >= $start && $ts <= $end;
            })->values()->all();
        }
        
        // Apply search filter in PHP if provided
        if (!empty($this->search)) {
            $searchTerm = strtolower($this->search);
            $calls = collect($calls)->filter(function ($call) use ($searchTerm) {
                // Search in phone numbers
                if (isset($call['from_number']) && str_contains(strtolower($call['from_number']), $searchTerm)) {
                    return true;
                }
                if (isset($call['to_number']) && str_contains(strtolower($call['to_number']), $searchTerm)) {
                    return true;
                }
                
                // Search in call summary
                if (isset($call['call_analysis']) && 
                    isset($call['call_analysis']['call_summary']) && 
                    str_contains(strtolower($call['call_analysis']['call_summary']), $searchTerm)) {
                    return true;
                }
                
                // Search in transcript
                if (isset($call['transcript']) && 
                    str_contains(strtolower($call['transcript']), $searchTerm)) {
                    return true;
                }
                
                // Search in call status
                if (isset($call['call_status']) && 
                    str_contains(strtolower($call['call_status']), $searchTerm)) {
                    return true;
                }
                
                // Search in sentiment
                if (isset($call['call_analysis']) && 
                    isset($call['call_analysis']['user_sentiment']) && 
                    str_contains(strtolower($call['call_analysis']['user_sentiment']), $searchTerm)) {
                    return true;
                }
                
                return false;
            })->values()->all();
            
            // Log search results
            Log::info('Search results', [
                'term' => $searchTerm,
                'results' => count($calls)
            ]);
        }
        
        // Apply sorting
        $calls = collect($calls)->sortBy($this->sortField, SORT_REGULAR, $this->sortDirection === 'desc')->values()->all();
        
        // Apply pagination
        $perPage = $this->perPage;
        $total = count($calls);
        
        $paginatedCalls = array_slice($calls, ($page - 1) * $perPage, $perPage);
        
        return [
            'calls' => $paginatedCalls,
            'total' => $total,
            'current_page' => (int)$page,
            'per_page' => (int)$perPage,
            'last_page' => ceil($total / $perPage)
        ];
    }

    public function getCallDetails($callId)
    {
        try {
            // Use cache for individual call details too
            $cacheKey = "call_detail_{$callId}";
            
            $call = Cache::remember($cacheKey, 30, function() use ($callId) {
                return $this->retellService->getCall($callId);
            });
            
            if (!$call) {
                return response()->json([
                    'error' => 'Call record not found.'
                ], 404);
            }
            
            return response()->json([
                'call' => $call
            ]);
            
        } catch (\Exception $e) {
            Log::error('Error fetching call details', [
                'error' => $e->getMessage(),
                'call_id' => $callId
            ]);
            
            return response()->json([
                'error' => 'Error fetching call details: ' . $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Clear call records cache
     * This can be called when new calls are detected
     */
    public function clearCallRecordsCache()
    {
        $this->clearCache('call_records');
        return response()->json(['success' => true, 'message' => 'Call records cache cleared']);
    }
} 