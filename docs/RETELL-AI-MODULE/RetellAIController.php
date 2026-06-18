<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use App\Models\Appointment;
use App\Services\TransactionService;
use App\Jobs\ProcessNewLead;
use App\Jobs\ProcessAppointmentEmail;
use App\Http\Resources\AppointmentResource;
use App\Http\Resources\AppointmentCollection;
use Carbon\Carbon;
use Illuminate\Support\Str;
use Throwable;

class RetellAIController extends Controller
{
    protected TransactionService $transactionService;

    public function __construct(TransactionService $transactionService)
    {
        $this->transactionService = $transactionService;
    }

    /**
     * Validate API key for all requests
     */
    private function validateApiKey(Request $request)
    {
        // TEMPORARY: Skip API key validation for testing
        // TODO: Remove this after fixing the JSON parsing issue
        Log::info('TEMPORARY: Skipping API key validation for testing');
        return null;
        
        // Try multiple ways to get the API key
        $apiKey = $request->header('X-API-KEY') ?? 
                  $request->input('api_key') ?? 
                  $request->get('api_key');
        
        // If still null, try to get from JSON body directly
        if (is_null($apiKey)) {
            try {
                $jsonData = $request->json()->all();
                $apiKey = $jsonData['api_key'] ?? null;
            } catch (\Exception $e) {
                // JSON parsing failed, will try raw content
            }
        }
        
        // If still null, try raw input
        if (is_null($apiKey)) {
            $content = $request->getContent();
            if (!empty($content)) {
                $decoded = json_decode($content, true);
                if (is_array($decoded) && isset($decoded['api_key'])) {
                    $apiKey = $decoded['api_key'];
                }
            }
        }
        
        $validApiKey = env('API_KEY_STORE_API_REST');
        
        // DETAILED debug logs
        Log::info('RetellAI DETAILED API Key Debug', [
            'step1_header_x_api_key' => $request->header('X-API-KEY'),
            'step2_input_api_key' => $request->input('api_key'),
            'step3_get_api_key' => $request->get('api_key'),
            'step4_json_available' => $request->json() !== null,
            'step4_json_data' => $request->json() ? $request->json()->all() : 'JSON_NULL',
            'step5_raw_content' => $request->getContent(),
            'step5_raw_content_length' => strlen($request->getContent()),
            'step5_json_decode' => json_decode($request->getContent(), true),
            'final_api_key' => $apiKey,
            'valid_api_key' => $validApiKey,
            'request_method' => $request->method(),
            'content_type' => $request->header('Content-Type'),
            'request_has_json' => $request->isJson(),
            'all_headers' => $request->headers->all(),
            'all_input' => $request->all(),
            'query_params' => $request->query->all(),
            'request_format' => $request->format(),
        ]);
        
        if ($apiKey !== $validApiKey) {
            Log::warning('RetellAI API Key Validation Failed', [
                'received' => $apiKey,
                'expected' => $validApiKey,
                'are_equal' => $apiKey === $validApiKey,
                'received_length' => strlen($apiKey ?? ''),
                'expected_length' => strlen($validApiKey ?? ''),
                'received_type' => gettype($apiKey),
                'expected_type' => gettype($validApiKey)
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized access - Invalid API key'
            ], 401);
        }
        
        return null;
    }

    /**
     * Clear appointments cache - Consistent with AppointmentCalendarController
     */
    private function clearAppointmentsCache()
    {
        // Clear general appointment caches (more specific than Cache::flush())
        Cache::forget('appointments');
        
        // Clear calendar event cache for all potential date ranges
        $cacheKeys = Cache::get('calendar_event_keys', []);
        foreach ($cacheKeys as $key) {
            Cache::forget($key);
        }
        Cache::forget('calendar_event_keys');
        
        // Clear other related caches
        Cache::forget('calendar_available_clients');
        
        Log::info('Appointments cache cleared via Retell AI');
    }

    /**
     * Parse request data manually to handle Retell AI JSON format
     */
    private function parseRequestData(Request $request)
    {
        // First try standard Laravel parsing
        $data = $request->all();
        
        // If data is empty or missing required fields, try manual parsing
        if (empty($data) || !isset($data['first_name'])) {
            Log::info('Standard parsing failed, trying manual JSON parsing for Retell AI');
            
            try {
                // Try Laravel's JSON method first
                $jsonData = $request->json()->all();
                if (!empty($jsonData)) {
                    $data = $jsonData;
                    
                    // Check if data is in 'args' structure (common with Retell AI)
                    if (isset($data['args']) && is_array($data['args'])) {
                        Log::info('Found args structure, extracting data');
                        $data = $data['args'];
                    }
                    
                    // Check if data is in some other nested structure
                    if (!isset($data['first_name']) && count($data) === 1) {
                        $firstKey = array_keys($data)[0];
                        if (is_array($data[$firstKey]) && isset($data[$firstKey]['first_name'])) {
                            Log::info("Found nested structure under key: {$firstKey}");
                            $data = $data[$firstKey];
                        }
                    }
                }
            } catch (\Exception $e) {
                Log::info('Laravel json() method failed', ['error' => $e->getMessage()]);
            }
            
            // If still empty, try raw content parsing
            if (empty($data) || !isset($data['first_name'])) {
                $content = $request->getContent();
                
                if (!empty($content)) {
                    $decoded = json_decode($content, true);
                    if (is_array($decoded) && !empty($decoded)) {
                        $data = $decoded;
                        
                        // Check for args structure in raw parsing too
                        if (isset($data['args']) && is_array($data['args'])) {
                            Log::info('Found args structure in raw parsing');
                            $data = $data['args'];
                        }
                        
                        // Check for other nested structures
                        if (!isset($data['first_name']) && count($data) === 1) {
                            $firstKey = array_keys($data)[0];
                            if (is_array($data[$firstKey]) && isset($data[$firstKey]['first_name'])) {
                                Log::info("Found nested structure in raw parsing under key: {$firstKey}");
                                $data = $data[$firstKey];
                            }
                        }
                    } else {
                        Log::error('Failed to decode JSON content', [
                            'json_error' => json_last_error_msg(),
                            'content_sample' => substr($content, 0, 100)
                        ]);
                    }
                }
            }
        }
        
        Log::info('Final parsed data for Retell AI', [
            'data_count' => count($data),
            'has_required_fields' => isset($data['first_name']) || isset($data['uuid']) || isset($data['api_key']),
            'method' => $request->method()
        ]);
        
        return $data;
    }

    /**
     * Store a new lead/appointment
     * POST /api/retell/leads
     */
    public function storeLead(Request $request)
    {
        // Validate API key
        if ($response = $this->validateApiKey($request)) {
            return $response;
        }

        // Parse request data manually to handle Retell AI JSON format
        $requestData = $this->parseRequestData($request);
        
        $validator = Validator::make($requestData, [
            'first_name' => ['required', 'min:2', 'regex:/^[A-Za-z\s\'-]+$/'],
            'last_name' => ['required', 'min:2', 'regex:/^[A-Za-z\s\'-]+$/'],
            'phone' => ['required', 'string', 'min:10', 'max:15'], // Required phone validation
            'email' => 'nullable|email', // Email is now optional
            'address' => 'required|min:5',
            'address_2' => 'nullable|string',
            'city' => 'required|string',
            'state' => 'required|string',
            'zipcode' => 'required|digits:5',
            'country' => 'required|string',
            'insurance_property' => 'required|string',
            'intent_to_claim' => 'nullable|string',
            'notes' => 'nullable|string',
            'damage_detail' => 'nullable|string',
            'sms_consent' => 'nullable|boolean',
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'lead_source' => 'nullable|string',
            'status_lead' => 'nullable|string|in:New,Called,Pending,Declined',
            'inspection_date' => 'nullable|date|after_or_equal:today',
            'inspection_time' => 'nullable|date_format:H:i',
        ]);

        if ($validator->fails()) {
            Log::error('Retell AI validation failed', [
                'errors' => $validator->errors()->toArray(),
                'received_data' => $requestData,
                'data_keys' => array_keys($requestData),
                'request_method' => $request->method(),
                'content_type' => $request->header('Content-Type'),
                'request_size' => strlen($request->getContent())
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
                'debug_info' => [
                    'received_fields' => array_keys($requestData),
                    'missing_required' => array_diff(['first_name', 'last_name', 'phone', 'address', 'city', 'state', 'zipcode', 'country', 'insurance_property'], array_keys($requestData))
                ]
            ], 422);
        }

        $validatedData = $validator->validated();

        // Format and validate phone number
        $formattedPhone = $this->formatPhoneNumber($validatedData['phone']);
        
        // Validate formatted phone number
        if (!preg_match('/^\(\d{3}\)\s\d{3}-\d{4}$/', $formattedPhone)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid phone number format',
                'errors' => [
                    'phone' => [
                        'Phone number must be a valid 10-digit US number. Received: ' . $validatedData['phone'] . ', Formatted: ' . $formattedPhone
                    ]
                ]
            ], 422);
        }
        
        // Update validated data with formatted phone
        $validatedData['phone'] = $formattedPhone;

        try {
            // Check if email already exists (only if email is provided)
            if (!empty($validatedData['email'])) {
                $existingAppointment = Appointment::where('email', $validatedData['email'])->first();
                
                if ($existingAppointment) {
                    return response()->json([
                        'success' => false,
                        'duplicate_email' => true,
                        'message' => 'This email is already registered in our system.',
                        'data' => new AppointmentResource($existingAppointment)
                    ], 422);
                }
            }

            // Check for schedule conflicts if inspection date/time provided
            if (!empty($validatedData['inspection_date']) && !empty($validatedData['inspection_time'])) {
                $conflictCheck = $this->checkScheduleConflict($validatedData['inspection_date'], $validatedData['inspection_time']);
                if ($conflictCheck) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Schedule conflict: This time slot is already booked.',
                        'errors' => ['schedule_conflict' => 'Please select a different date or time.']
                    ], 422);
                }
            }
            
            $appointment = $this->transactionService->run(
                // Database operations
                function () use ($validatedData) {
                    // Convert insurance_property and intent_to_claim to boolean
                    $insuranceProperty = $this->convertToBoolean($validatedData['insurance_property']);
                    $intentToClaim = $this->convertToBoolean($validatedData['intent_to_claim'] ?? false);

                    $appointmentData = [
                        'uuid' => Str::uuid(),
                        'first_name' => $validatedData['first_name'],
                        'last_name' => $validatedData['last_name'],
                        'phone' => $validatedData['phone'],
                        'email' => $validatedData['email'],
                        'address' => $validatedData['address'],
                        'address_2' => $validatedData['address_2'] ?? null,
                        'city' => $validatedData['city'],
                        'state' => $validatedData['state'],
                        'zipcode' => $validatedData['zipcode'],
                        'country' => $validatedData['country'],
                        'insurance_property' => $insuranceProperty,
                        'intent_to_claim' => $intentToClaim,
                        'notes' => $validatedData['notes'] ?? null,
                        'damage_detail' => $validatedData['damage_detail'] ?? null,
                        'sms_consent' => filter_var($validatedData['sms_consent'] ?? false, FILTER_VALIDATE_BOOLEAN),
                        'registration_date' => Carbon::now(),
                        'inspection_status' => 'Pending',
                        'status_lead' => $validatedData['status_lead'] ?? 'New',
                        'latitude' => $validatedData['latitude'] ?? null,
                        'longitude' => $validatedData['longitude'] ?? null,
                        'lead_source' => $validatedData['lead_source'] ?? 'Retell AI',
                        'inspection_date' => $validatedData['inspection_date'] ?? null,
                        'inspection_time' => $validatedData['inspection_time'] ?? null,
                    ];

                    // If inspection date/time provided, set status to Confirmed
                    if (!empty($appointmentData['inspection_date']) && !empty($appointmentData['inspection_time'])) {
                        $appointmentData['inspection_status'] = 'Confirmed';
                        $appointmentData['status_lead'] = 'Called';
                    }

                    $newAppointment = Appointment::create($appointmentData);
                    
                    $this->clearAppointmentsCache();

                    Log::info('Retell AI Lead successfully created.', ['email' => $validatedData['email']]);
                    return $newAppointment;
                },
                // Post-Commit actions
                function ($createdAppointment) {
                    // Follow same logic as AppointmentController::afterStore()
                    // If appointment has inspection date and time, send confirmation email instead of new lead notification
                    if ($createdAppointment->inspection_status === 'Confirmed' && 
                        $createdAppointment->inspection_date && 
                        $createdAppointment->inspection_time) {
                        
                        ProcessAppointmentEmail::dispatch($createdAppointment, 'confirmed');
                        Log::info('Retell AI: Appointment confirmation email dispatched via creation', [
                            'appointment_uuid' => $createdAppointment->uuid,
                            'email' => $createdAppointment->email
                        ]);
                    } else {
                        // Otherwise, send the standard new lead notification
                    ProcessNewLead::dispatch($createdAppointment);
                        Log::info('Retell AI: New lead notification dispatched', [
                            'appointment_uuid' => $createdAppointment->uuid,
                            'email' => $createdAppointment->email
                        ]);
                    }
                },
                // Error actions
                function (Throwable $e) use ($validatedData) {
                    Log::error('Error occurred during Retell AI transaction.', [
                        'error_message' => $e->getMessage(),
                        'email' => $validatedData['email'] ?? 'N/A'
                    ]);
                }
            );

            return response()->json([
                'success' => true,
                'message' => 'Lead successfully created',
                'data' => new AppointmentResource($appointment)
            ], 201);

        } catch (Throwable $e) {
            Log::error('Failed to process Retell AI lead submission.', [
                'error_message' => $e->getMessage(),
                'email' => $validatedData['email'] ?? 'N/A'
            ]);

            return response()->json([
                'success' => false,
                'message' => 'An error occurred while processing your request'
            ], 500);
        }
    }

    /**
     * Get calendar availability with flexible date search options
     * POST /api/retell/appointments/availability
     * 
     * Search options:
     * 1. Single date: { "date": "2025-06-20" }
     * 2. Date range: { "start_date": "2025-06-20", "end_date": "2025-06-25" }
     * 3. From start date: { "start_date": "2025-06-20", "days_ahead": 7 }
     * 4. Default (no dates): Shows current month + following months
     */
    public function getAvailability(Request $request)
    {
        // Validate API key
        if ($response = $this->validateApiKey($request)) {
            return $response;
        }

        // Parse request data manually to handle Retell AI JSON format
        $requestData = $this->parseRequestData($request);

        $validator = Validator::make($requestData, [
            'start_date' => 'nullable|date|after_or_equal:today',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'date' => 'nullable|date|after_or_equal:today', // Single date search
            'days_ahead' => 'nullable|integer|min:1|max:90', // Days from start_date or today
            'months_ahead' => 'nullable|integer|min:1|max:6', // Months from today
            'api_key' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
                'message' => 'Invalid date parameters provided'
            ], 422);
        }

        try {
            $startDate = null;
            $endDate = null;
            $periodType = 'default';
            $searchDescription = '';

            // Priority 1: Single date search
            if (isset($requestData['date']) && !empty($requestData['date'])) {
                $singleDate = $this->convertDateFormat($requestData['date']);
                $startDate = $singleDate;
                $endDate = $singleDate;
                $periodType = 'single_date';
                $searchDescription = 'Single date: ' . $singleDate;
            }
            // Priority 2: Date range search (start_date + end_date)
            elseif (isset($requestData['start_date']) && !empty($requestData['start_date']) && 
                    isset($requestData['end_date']) && !empty($requestData['end_date'])) {
                $startDate = $this->convertDateFormat($requestData['start_date']);
                $endDate = $this->convertDateFormat($requestData['end_date']);
                $periodType = 'date_range';
                $searchDescription = 'Date range: ' . $startDate . ' to ' . $endDate;
            }
            // Priority 3: From start_date with days_ahead
            elseif (isset($requestData['start_date']) && !empty($requestData['start_date'])) {
                $startDate = $this->convertDateFormat($requestData['start_date']);
                $daysAhead = $requestData['days_ahead'] ?? 7; // Default 7 days if not specified
                $endDate = Carbon::parse($startDate)->addDays($daysAhead)->format('Y-m-d');
                $periodType = 'start_date_with_days';
                $searchDescription = 'From ' . $startDate . ' for ' . $daysAhead . ' days';
            }
            // Priority 4: Default behavior (current month + following months)
            else {
                $today = Carbon::now();
                $monthsAhead = $requestData['months_ahead'] ?? 2;
                $startDate = $today->format('Y-m-d');
                $endDate = $today->copy()->addMonths($monthsAhead)->endOfMonth()->format('Y-m-d');
                $periodType = 'current_and_following_months';
                $searchDescription = 'Default: Current month + ' . $monthsAhead . ' following months';
            }

            // Validate that end_date is not before start_date
            if (Carbon::parse($endDate)->lt(Carbon::parse($startDate))) {
                return response()->json([
                    'success' => false,
                    'message' => 'End date cannot be before start date',
                    'errors' => ['date_range' => 'Please check your date range']
                ], 422);
            }

            $availability = $this->getCalendarAvailability($startDate, $endDate);

            // Calculate months included
            $startMonth = Carbon::parse($startDate);
            $endMonth = Carbon::parse($endDate);
            $monthsIncluded = [];
            
            $currentMonth = $startMonth->copy()->startOfMonth();
            while ($currentMonth->lte($endMonth)) {
                $monthsIncluded[] = $currentMonth->format('F Y');
                $currentMonth->addMonth();
            }

            return response()->json([
                'success' => true,
                'data' => $availability,
                'period' => [
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'total_days' => Carbon::parse($startDate)->diffInDays(Carbon::parse($endDate)) + 1,
                    'period_type' => $periodType,
                    'search_description' => $searchDescription,
                    'months_included' => $monthsIncluded,
                    'total_months' => count($monthsIncluded)
                ],
                'message' => $periodType === 'current_and_following_months' 
                    ? 'Current month remaining days and following complete months retrieved successfully' 
                    : 'Calendar availability retrieved successfully',
                'search_info' => [
                    'type' => $periodType,
                    'description' => $searchDescription,
                    'working_days_only' => 'Monday to Saturday (excluding Sundays)'
                ]
            ]);

        } catch (Throwable $e) {
            Log::error('Failed to fetch availability via Retell AI.', [
                'error_message' => $e->getMessage(),
                'request_data' => $requestData
            ]);

            return response()->json([
                'success' => false,
                'message' => 'An error occurred while fetching availability'
            ], 500);
        }
    }

    /**
     * Get client appointments with flexible search criteria
     * POST /api/retell/appointments/client
     * 
     * Search options:
     * 1. By date/time: inspection_date + inspection_time
     * 2. By name: first_name + last_name
     * 3. By contact: email OR phone
     * 4. Multiple criteria can be combined
     */
    public function getClientAppointments(Request $request)
    {
        // Validate API key
        if ($response = $this->validateApiKey($request)) {
            return $response;
        }

        // Parse request data manually to handle Retell AI JSON format
        $requestData = $this->parseRequestData($request);

        $validator = Validator::make($requestData, [
            'email' => 'nullable|email',
            'phone' => 'nullable|string',
            'first_name' => 'nullable|string|min:2',
            'last_name' => 'nullable|string|min:2',
            'inspection_date' => 'nullable|date',
            'inspection_time' => 'nullable|date_format:H:i:s,H:i',
            'api_key' => 'nullable|string', // Allow api_key in body as well
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
                'message' => 'Invalid search parameters provided'
            ], 422);
        }

        try {
            $query = Appointment::query();
            $searchCriteria = [];
            $searchType = '';

            // Priority 1: Search by email (most specific)
            if (isset($requestData['email']) && !empty($requestData['email'])) {
                $query->where('email', $requestData['email']);
                $searchCriteria['email'] = $requestData['email'];
                $searchType = 'email';
            }

            // Priority 2: Search by phone
            if (isset($requestData['phone']) && !empty($requestData['phone'])) {
                // Format the phone number to match database format before searching
                $formattedPhone = $this->formatPhoneNumber($requestData['phone']);
                
                Log::info('Retell AI: Phone search formatting', [
                    'original_phone' => $requestData['phone'],
                    'formatted_phone' => $formattedPhone
                ]);
                
                // Search with both original and formatted phone for maximum compatibility
                $query->where(function($phoneQuery) use ($requestData, $formattedPhone) {
                    $phoneQuery->where('phone', $requestData['phone'])  // Try original format
                               ->orWhere('phone', $formattedPhone);        // Try formatted version
                });
                
                $searchCriteria['phone'] = $requestData['phone'];
                $searchCriteria['formatted_phone'] = $formattedPhone;
                $searchType = empty($searchType) ? 'phone' : $searchType . '+phone';
            }

            // Priority 3: Search by first_name and last_name (both required if provided)
            if (isset($requestData['first_name']) && !empty($requestData['first_name']) && 
                isset($requestData['last_name']) && !empty($requestData['last_name'])) {
                $query->where('first_name', 'LIKE', '%' . $requestData['first_name'] . '%')
                      ->where('last_name', 'LIKE', '%' . $requestData['last_name'] . '%');
                $searchCriteria['first_name'] = $requestData['first_name'];
                $searchCriteria['last_name'] = $requestData['last_name'];
                $searchType = empty($searchType) ? 'name' : $searchType . '+name';
            }

            // Priority 4: Search by inspection date and time
            if (isset($requestData['inspection_date']) && !empty($requestData['inspection_date'])) {
                $inspectionDate = $this->convertDateFormat($requestData['inspection_date']);
                $query->whereDate('inspection_date', $inspectionDate);
                $searchCriteria['inspection_date'] = $inspectionDate;
                $searchType = empty($searchType) ? 'date' : $searchType . '+date';
                
                Log::info('Retell AI: Searching by inspection_date', [
                    'original_date' => $requestData['inspection_date'],
                    'converted_date' => $inspectionDate
                ]);

                // If time is also provided, add it to search
                if (isset($requestData['inspection_time']) && !empty($requestData['inspection_time'])) {
                    $inspectionTime = $requestData['inspection_time'];
                    // Convert from HH:MM:SS to HH:MM if needed
                    if (strlen($inspectionTime) === 8) {
                        $inspectionTime = substr($inspectionTime, 0, 5);
                    }
                    $query->whereTime('inspection_time', $inspectionTime);
                    $searchCriteria['inspection_time'] = $inspectionTime;
                    $searchType = str_replace('date', 'date+time', $searchType);
                
                    Log::info('Retell AI: Searching by inspection_time', [
                        'original_time' => $requestData['inspection_time'],
                        'converted_time' => $inspectionTime
                    ]);
                }
            } elseif (isset($requestData['inspection_time']) && !empty($requestData['inspection_time'])) {
                // Time only search (without date)
                $inspectionTime = $requestData['inspection_time'];
                if (strlen($inspectionTime) === 8) {
                    $inspectionTime = substr($inspectionTime, 0, 5);
                }
                $query->whereTime('inspection_time', $inspectionTime);
                $searchCriteria['inspection_time'] = $inspectionTime;
                $searchType = empty($searchType) ? 'time' : $searchType . '+time';
            }

            // If no search criteria provided, return recent appointments (with limit for performance)
            if (empty($searchCriteria)) {
                $query->limit(50); // Reduced limit for better performance
                $searchCriteria['note'] = 'No search criteria provided, returning latest 50 appointments';
                $searchType = 'recent';
            }

            // Get the SQL query for debugging
            $sqlQuery = $query->toSql();
            $bindings = $query->getBindings();
            
            Log::info('Retell AI: Executing client search query', [
                'sql' => $sqlQuery,
                'bindings' => $bindings,
                'search_criteria' => $searchCriteria,
                'search_type' => $searchType
            ]);

            $appointments = $query->orderBy('created_at', 'desc')->get();

            // Generate appropriate response message
            $message = 'Client appointments retrieved successfully';
            if ($appointments->isEmpty()) {
                $message = $this->generateNoResultsMessage($searchCriteria, $searchType);
                
                return response()->json([
                    'success' => true,
                    'data' => [],
                    'count' => 0,
                    'message' => $message,
                    'search_criteria' => $searchCriteria,
                    'search_type' => $searchType,
                    'suggestions' => $this->getSearchSuggestions($searchType)
                ]);
            }

            return response()->json([
                'success' => true,
                'data' => AppointmentResource::collection($appointments),
                'count' => $appointments->count(),
                'message' => $message,
                'search_criteria' => $searchCriteria,
                'search_type' => $searchType
            ]);

        } catch (Throwable $e) {
            Log::error('Failed to fetch client appointments via Retell AI.', [
                'error_message' => $e->getMessage(),
                'search_params' => $requestData,
                'stack_trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'An error occurred while fetching client appointments'
            ], 500);
        }
    }

    /**
     * Generate appropriate "no results" message based on search criteria
     */
    private function generateNoResultsMessage($searchCriteria, $searchType)
    {
        switch ($searchType) {
            case 'email':
                return 'No clients found with email: ' . $searchCriteria['email'];
            case 'phone':
                $phoneMessage = 'No clients found with phone: ' . $searchCriteria['phone'];
                if (isset($searchCriteria['formatted_phone']) && $searchCriteria['formatted_phone'] !== $searchCriteria['phone']) {
                    $phoneMessage .= ' (also searched as: ' . $searchCriteria['formatted_phone'] . ')';
                }
                return $phoneMessage;
            case 'name':
                return 'No clients found with name: ' . $searchCriteria['first_name'] . ' ' . $searchCriteria['last_name'];
            case 'date':
                return 'No clients found for date: ' . $searchCriteria['inspection_date'];
            case 'time':
                return 'No clients found for time: ' . $searchCriteria['inspection_time'];
            case 'date+time':
                return 'No clients found for ' . $searchCriteria['inspection_date'] . ' at ' . $searchCriteria['inspection_time'];
            default:
                if (str_contains($searchType, '+')) {
                    return 'No clients found matching the combined search criteria';
                }
                return 'No clients found';
        }
    }

    /**
     * Get search suggestions when no results found
     */
    private function getSearchSuggestions($searchType)
    {
        $suggestions = [
            'Try searching with different criteria',
            'Check if the date format is correct (YYYY-MM-DD)',
            'Verify the time format is correct (HH:MM)',
            'Use partial name search if exact match fails'
        ];

        switch ($searchType) {
            case 'email':
                return ['Double-check the email address', 'Try searching by phone or name instead'];
            case 'phone':
                return ['Verify the phone number format', 'Try searching by email or name instead'];
            case 'name':
                return ['Try partial name matches', 'Check spelling of first and last name'];
            case 'date':
            case 'time':
            case 'date+time':
                return ['Try a broader date range', 'Check if the appointment exists on a different date/time'];
            default:
                return $suggestions;
        }
    }

    /**
     * Get specific appointment
     * POST /api/retell/appointments/get
     */
    public function getAppointment(Request $request)
    {
        // Validate API key
        if ($response = $this->validateApiKey($request)) {
            return $response;
        }

        // Parse request data manually to handle Retell AI JSON format
        $requestData = $this->parseRequestData($request);

        // Validate request body
        $validator = Validator::make($requestData, [
            'uuid' => 'required|string',
            'api_key' => 'nullable|string', // Allow api_key in body as well
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $uuid = $requestData['uuid'];
            $appointment = Appointment::where('uuid', $uuid)->first();

            if (!$appointment) {
                return response()->json([
                    'success' => false,
                    'message' => 'Appointment not found'
                ], 404);
            }

            return response()->json([
                'success' => true,
                'data' => new AppointmentResource($appointment)
            ]);

        } catch (Throwable $e) {
            Log::error('Failed to fetch appointment via Retell AI.', [
                'error_message' => $e->getMessage(),
                'uuid' => $requestData['uuid'] ?? 'N/A'
            ]);

            return response()->json([
                'success' => false,
                'message' => 'An error occurred while fetching the appointment'
            ], 500);
        }
    }

    /**
     * Update appointment (personal data only)
     * PATCH /api/retell/appointments/update
     */
    public function updateAppointment(Request $request)
    {
        // Validate API key
        if ($response = $this->validateApiKey($request)) {
            return $response;
        }

        // Parse request data manually to handle Retell AI JSON format
        $requestData = $this->parseRequestData($request);

        $validator = Validator::make($requestData, [
            'uuid' => 'required|string',
            'first_name' => 'nullable|string|min:1', // More flexible for updates
            'last_name' => 'nullable|string|min:1',  // More flexible for updates
            'phone' => 'nullable|string|min:10|max:15', // Accept any phone format, will be formatted later
            'email' => 'nullable|email',
            'address' => 'nullable|string|min:1', // More flexible for updates
            'city' => 'nullable|string|min:1',
            'state' => 'nullable|string|min:1',
            'zipcode' => 'nullable|string|size:5', // Changed from digits to string to allow leading zeros
            'notes' => 'nullable|string',
            'damage_detail' => 'nullable|string',
            'api_key' => 'nullable|string', // Allow api_key in body as well
        ]);

        if ($validator->fails()) {
            Log::error('Retell AI update validation failed', [
                'errors' => $validator->errors()->toArray(),
                'received_data' => $requestData,
                'data_keys' => array_keys($requestData),
                'uuid' => $requestData['uuid'] ?? 'N/A'
            ]);
            
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
                'debug_info' => [
                    'received_fields' => array_keys($requestData),
                    'uuid_provided' => isset($requestData['uuid'])
                ]
            ], 422);
        }

        try {
            $uuid = $requestData['uuid'];
            $appointment = Appointment::where('uuid', $uuid)->first();

            if (!$appointment) {
                return response()->json([
                    'success' => false,
                    'message' => 'Appointment not found'
                ], 404);
            }

            $validatedData = $validator->validated();
            // Remove uuid from validated data since it's not a model field
            unset($validatedData['uuid']);
            unset($validatedData['api_key']);

            // Format phone number if provided
            if (isset($validatedData['phone']) && !empty($validatedData['phone'])) {
                $originalPhone = $validatedData['phone'];
                $formattedPhone = $this->formatPhoneNumber($originalPhone);
                
                Log::info('Retell AI: Update phone formatting', [
                    'original_phone' => $originalPhone,
                    'formatted_phone' => $formattedPhone
                ]);
                
                // Only validate if we successfully formatted to the expected pattern
                if (preg_match('/^\(\d{3}\)\s\d{3}-\d{4}$/', $formattedPhone)) {
                    $validatedData['phone'] = $formattedPhone;
                } else {
                    // If formatting failed, keep original but log warning
                    Log::warning('Phone formatting failed in update, keeping original', [
                        'original' => $originalPhone,
                        'formatted_attempt' => $formattedPhone
                    ]);
                    
                    // Only proceed if the original looks like a valid phone number (10-15 digits)
                    $digitsOnly = preg_replace('/[^0-9]/', '', $originalPhone);
                    if (strlen($digitsOnly) < 10 || strlen($digitsOnly) > 15) {
                        return response()->json([
                            'success' => false,
                            'message' => 'Invalid phone number format',
                            'errors' => [
                                'phone' => [
                                    'Phone number must contain 10-15 digits. Received: ' . $originalPhone
                                ]
                            ]
                        ], 422);
                    }
                    // Keep original phone if it has valid digit count
                    $validatedData['phone'] = $originalPhone;
                }
            }

            $updatedAppointment = $this->transactionService->run(
                // Database operations
                function () use ($appointment, $validatedData) {
                    // Update only personal data fields that are present in request
                    $appointment->fill($validatedData);
                    $appointment->save();
                    
                    $this->clearAppointmentsCache();

                    Log::info('Retell AI Appointment personal data updated.', ['uuid' => $appointment->uuid]);
                    return $appointment;
                },
                // Post-Commit actions
                function ($updatedAppointment) {
                    // No email notifications needed for personal data updates
                    Log::info('Retell AI: Personal data updated successfully', ['uuid' => $updatedAppointment->uuid]);
                }
            );

            return response()->json([
                'success' => true,
                'message' => 'Appointment personal data updated successfully',
                'data' => new AppointmentResource($updatedAppointment)
            ]);

        } catch (Throwable $e) {
            Log::error('Failed to update appointment personal data via Retell AI.', [
                'error_message' => $e->getMessage(),
                'uuid' => $requestData['uuid'] ?? 'N/A'
            ]);

            return response()->json([
                'success' => false,
                'message' => 'An error occurred while updating the appointment personal data'
            ], 500);
        }
    }

    /**
     * Mark appointment as declined (soft decline instead of delete)
     * DELETE /api/retell/appointments/delete
     */
    public function deleteAppointment(Request $request)
    {
        // Validate API key
        if ($response = $this->validateApiKey($request)) {
            return $response;
        }

        // Parse request data manually to handle Retell AI JSON format
        $requestData = $this->parseRequestData($request);

        // Validate request body
        $validator = Validator::make($requestData, [
            'uuid' => 'required|string',
            'api_key' => 'nullable|string', // Allow api_key in body as well
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $uuid = $requestData['uuid'];
            $appointment = Appointment::where('uuid', $uuid)->first();

            if (!$appointment) {
                return response()->json([
                    'success' => false,
                    'message' => 'Appointment not found'
                ], 404);
            }

            $updatedAppointment = $this->transactionService->run(
                function () use ($appointment) {
                    // Mark as declined instead of deleting
                    $appointment->inspection_status = 'Declined';
                    $appointment->status_lead = 'Declined';
                    
                    // Clear inspection date and time when declined
                    $appointment->inspection_date = null;
                    $appointment->inspection_time = null;
                    
                    // Add a note about the decline
                    $existingNotes = $appointment->notes ?? '';
                    $declineNote = 'Appointment declined via API on ' . Carbon::now()->format('Y-m-d H:i:s');
                    
                    if (!empty($existingNotes)) {
                        $appointment->notes = $existingNotes . "\n\n" . $declineNote;
                    } else {
                        $appointment->notes = $declineNote;
                    }
                    
                    $appointment->save();
                    
                    $this->clearAppointmentsCache();

                    Log::info('Retell AI Appointment marked as declined.', ['uuid' => $appointment->uuid]);
                    return $appointment;
                },
                // Post-Commit actions
                function ($updatedAppointment) {
                    // Send cancellation email notification
                    ProcessAppointmentEmail::dispatch($updatedAppointment, 'declined');
                    Log::info('Retell AI: Decline email queued for appointment', ['uuid' => $updatedAppointment->uuid]);
                }
            );

            return response()->json([
                'success' => true,
                'message' => 'Appointment marked as declined successfully. A notification email has been sent to the client.',
                'data' => new AppointmentResource($updatedAppointment)
            ]);

        } catch (Throwable $e) {
            Log::error('Failed to decline appointment via Retell AI.', [
                'error_message' => $e->getMessage(),
                'uuid' => $requestData['uuid'] ?? 'N/A'
            ]);

            return response()->json([
                'success' => false,
                'message' => 'An error occurred while declining the appointment'
            ], 500);
        }
    }

    /**
     * Reschedule appointment
     * POST /api/retell/appointments/reschedule
     */
    public function rescheduleAppointment(Request $request)
    {
        // Validate API key
        if ($response = $this->validateApiKey($request)) {
            return $response;
        }

        // Parse request data manually to handle Retell AI JSON format
        $requestData = $this->parseRequestData($request);

        $validator = Validator::make($requestData, [
            'uuid' => 'required|string',
            'new_date' => 'required|date|after_or_equal:today',
            'new_time' => 'required|date_format:H:i',
            'api_key' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $uuid = $requestData['uuid'];
            $appointment = Appointment::where('uuid', $uuid)->first();

            if (!$appointment) {
                return response()->json([
                    'success' => false,
                    'message' => 'Appointment not found'
                ], 404);
            }

            $validatedData = $validator->validated();

            // Convert date format if needed
            $newDate = $this->convertDateFormat($validatedData['new_date']);

            // Check for schedule conflicts
            $conflictCheck = $this->checkScheduleConflict($newDate, $validatedData['new_time'], $appointment->id);
            
            if ($conflictCheck) {
                return response()->json([
                    'success' => false,
                    'message' => 'Schedule conflict: The requested time slot is not available.',
                    'errors' => ['schedule_conflict' => 'Please select a different date or time.']
                ], 422);
            }

            $rescheduledAppointment = $this->transactionService->run(
                function () use ($appointment, $newDate, $validatedData) {
                    $appointment->inspection_date = $newDate;
                    $appointment->inspection_time = $validatedData['new_time'];
                    $appointment->inspection_status = 'Confirmed';
                    $appointment->status_lead = 'Called';
                    $appointment->save();
                    
                    $this->clearAppointmentsCache();

                    Log::info('Retell AI Appointment rescheduled.', ['uuid' => $appointment->uuid]);
                    return $appointment;
                },
                // Post-Commit actions
                function ($rescheduledAppointment) {
                    // Send rescheduled email notification
                    ProcessAppointmentEmail::dispatch($rescheduledAppointment, 'rescheduled');
                    Log::info('Retell AI: Reschedule email queued for appointment', ['uuid' => $rescheduledAppointment->uuid]);
                }
            );

            return response()->json([
                'success' => true,
                'message' => 'Appointment rescheduled successfully. A notification email has been sent to the client.',
                'data' => new AppointmentResource($rescheduledAppointment)
            ]);

        } catch (Throwable $e) {
            Log::error('Failed to reschedule appointment via Retell AI.', [
                'error_message' => $e->getMessage(),
                'uuid' => $requestData['uuid'] ?? 'N/A'
            ]);

            return response()->json([
                'success' => false,
                'message' => 'An error occurred while rescheduling the appointment'
            ], 500);
        }
    }

    /**
     * Update appointment status
     * PATCH /api/retell/appointments/status
     */
    public function updateAppointmentStatus(Request $request)
    {
        // Validate API key
        if ($response = $this->validateApiKey($request)) {
            return $response;
        }

        // Parse request data manually to handle Retell AI JSON format
        $requestData = $this->parseRequestData($request);

        $validator = Validator::make($requestData, [
            'uuid' => 'required|string',
            'inspection_status' => 'required|in:Pending,Confirmed,Completed,Declined',
            'status_lead' => 'nullable|in:New,Called,Pending,Declined',
            'api_key' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $uuid = $requestData['uuid'];
            $appointment = Appointment::where('uuid', $uuid)->first();

            if (!$appointment) {
                return response()->json([
                    'success' => false,
                    'message' => 'Appointment not found'
                ], 404);
            }

            $validatedData = $validator->validated();
            $originalStatus = $appointment->inspection_status;

            $message = 'Appointment status updated successfully.';

            $updatedAppointment = $this->transactionService->run(
                function () use ($appointment, $validatedData) {
                    $appointment->inspection_status = $validatedData['inspection_status'];
                    
                    // Set status_lead based on inspection_status if not provided
                    if (isset($validatedData['status_lead'])) {
                        $appointment->status_lead = $validatedData['status_lead'];
                    } else {
                        switch ($validatedData['inspection_status']) {
                            case 'Confirmed':
                            case 'Completed':
                                $appointment->status_lead = 'Called';
                                break;
                            case 'Declined':
                                $appointment->status_lead = 'Declined';
                                // Clear inspection date/time if declined
                                $appointment->inspection_date = null;
                                $appointment->inspection_time = null;
                                break;
                            case 'Pending':
                                if ($appointment->status_lead !== 'Pending') {
                                    $appointment->status_lead = 'New';
                                }
                                break;
                        }
                    }

                    $appointment->save();
                    
                    $this->clearAppointmentsCache();

                    Log::info('Retell AI Appointment status updated.', ['uuid' => $appointment->uuid]);
                    return $appointment;
                },
                // Post-Commit actions
                function ($updatedAppointment) use ($originalStatus, &$message) {
                    $emailType = null;
                    
                    // Send email notification based on new status (only if status changed)
                    if ($originalStatus !== $updatedAppointment->inspection_status) {
                        switch ($updatedAppointment->inspection_status) {
                            case 'Confirmed':
                                $emailType = 'confirmed';
                                $message = 'Appointment confirmed successfully. A confirmation email has been sent to the client.';
                                break;
                            case 'Declined':
                                $emailType = 'declined';
                                $message = 'Appointment declined successfully. A notification email has been sent to the client.';
                                break;
                        }
                        
                        if ($emailType) {
                            ProcessAppointmentEmail::dispatch($updatedAppointment, $emailType);
                            Log::info("Retell AI: {$emailType} email queued for appointment", ['uuid' => $updatedAppointment->uuid]);
                        }
                    }
                }
            );

            return response()->json([
                'success' => true,
                'message' => $message,
                'data' => new AppointmentResource($updatedAppointment)
            ]);

        } catch (Throwable $e) {
            Log::error('Failed to update appointment status via Retell AI.', [
                'error_message' => $e->getMessage(),
                'uuid' => $requestData['uuid'] ?? 'N/A'
            ]);

            return response()->json([
                'success' => false,
                'message' => 'An error occurred while updating the appointment status'
            ], 500);
        }
    }

    /**
     * Helper methods
     */

    /**
     * Convert string to boolean
     */
    private function convertToBoolean($value)
    {
        if (is_string($value)) {
            $value = strtolower($value);
            return in_array($value, ['yes', 'y', 'true', '1', 'si', 'sí']);
        }
        return (bool)$value;
    }

    /**
     * Convert date format from MM-DD-YYYY to YYYY-MM-DD
     */
    private function convertDateFormat($date)
    {
        if (empty($date)) return null;
        
        // If already in YYYY-MM-DD format
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            return $date;
        }
        
        // Convert from MM-DD-YYYY to YYYY-MM-DD
        $parts = explode('-', $date);
        if (count($parts) === 3) {
            return $parts[2] . '-' . $parts[0] . '-' . $parts[1];
        }
        
        return $date;
    }

    /**
     * Check for schedule conflicts
     */
    private function checkScheduleConflict($date, $time, $excludeId = null)
    {
        $query = Appointment::whereDate('inspection_date', $date)
            ->whereTime('inspection_time', $time)
            ->whereIn('inspection_status', ['Confirmed', 'Pending']);

        if ($excludeId) {
            $query->where('id', '!=', $excludeId);
        }

        return $query->exists();
    }

    /**
     * Get calendar availability for date range
     * Working days: Monday to Saturday (excluding Sundays)
     */
    private function getCalendarAvailability($startDate, $endDate)
    {
        // Working hours: 8 AM - 6 PM (11 time slots)
        $workingHours = [
            '08:00', '09:00', '10:00', '11:00', '12:00', 
            '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'
        ];
        
        // Get existing appointments
        $existingAppointments = Appointment::whereNotNull('inspection_date')
            ->whereNotNull('inspection_time')
            ->whereDate('inspection_date', '>=', $startDate)
            ->whereDate('inspection_date', '<=', $endDate)
            ->whereIn('inspection_status', ['Confirmed', 'Pending'])
            ->get(['inspection_date', 'inspection_time'])
            ->groupBy(function($appointment) {
                return $appointment->inspection_date->format('Y-m-d');
            });
        
        $calendar = ['days' => []];
        $totalAvailableSlots = 0;
        $totalSlots = 0;
        $workingDaysCount = 0;
        $monthlyBreakdown = [];
        
        $currentDate = Carbon::parse($startDate);
        $lastDate = Carbon::parse($endDate);
        
        while ($currentDate->lte($lastDate)) {
            $dateStr = $currentDate->format('Y-m-d');
            $dayOfWeek = $currentDate->dayOfWeek;
            $monthKey = $currentDate->format('Y-m'); // For monthly breakdown
            $monthName = $currentDate->format('F Y');
            
            // Initialize monthly breakdown if not exists
            if (!isset($monthlyBreakdown[$monthKey])) {
                $monthlyBreakdown[$monthKey] = [
                    'month' => $monthName,
                    'working_days' => 0,
                    'available_slots' => 0,
                    'total_slots' => 0
                ];
            }
            
            // Include Monday to Saturday (exclude only Sunday)
            // Carbon::SUNDAY = 0, Monday = 1, Tuesday = 2, ..., Saturday = 6
            if ($dayOfWeek !== Carbon::SUNDAY) {
                $workingDaysCount++;
                $monthlyBreakdown[$monthKey]['working_days']++;
                $daySlots = [];
                $availableSlotsForDay = 0;
                
                foreach ($workingHours as $time) {
                    $isReserved = false;
                    
                    if (isset($existingAppointments[$dateStr])) {
                        foreach ($existingAppointments[$dateStr] as $appointment) {
                            if ($appointment->inspection_time->format('H:i') === $time) {
                                $isReserved = true;
                                break;
                            }
                        }
                    }
                    
                    $isAvailable = !$isReserved;
                    if ($isAvailable) {
                        $availableSlotsForDay++;
                        $totalAvailableSlots++;
                        $monthlyBreakdown[$monthKey]['available_slots']++;
                    }
                    $totalSlots++;
                    $monthlyBreakdown[$monthKey]['total_slots']++;
                    
                    $daySlots[] = [
                        'time' => $time,
                        'formatted_time' => Carbon::parse($time)->format('h:i A'),
                        'available' => $isAvailable
                    ];
                }
                
                $calendar['days'][] = [
                    'date' => $dateStr,
                    'day_of_week' => $currentDate->format('l'),
                    'formatted_date' => $currentDate->format('F j, Y'),
                    'month' => $monthName,
                    'is_weekend' => $dayOfWeek === Carbon::SATURDAY,
                    'available_slots' => $availableSlotsForDay,
                    'total_slots' => count($workingHours),
                    'slots' => $daySlots
                ];
            }
            
            $currentDate->addDay();
        }
        
        // Add summary
        $calendar['summary'] = [
            'total_working_days' => $workingDaysCount,
            'total_available_slots' => $totalAvailableSlots,
            'total_slots' => $totalSlots,
            'monthly_breakdown' => array_values($monthlyBreakdown),
            'working_hours' => [
                'start_time' => '08:00',
                'end_time' => '18:00',
                'slots_per_day' => count($workingHours),
                'working_days' => 'Monday to Saturday',
                'excluded_days' => ['Sunday']
            ]
        ];
        
        return $calendar;
    }

    /**
     * Format phone number to (XXX) XXX-XXXX format
     */
    private function formatPhoneNumber($phone)
    {
        if (empty($phone)) {
            return $phone;
        }

        // Remove all non-numeric characters
        $phone = preg_replace('/[^0-9]/', '', $phone);
        
        // Remove leading 1 if present (US country code)
        if (strlen($phone) == 11 && substr($phone, 0, 1) == '1') {
            $phone = substr($phone, 1);
        }
        
        // Format to (XXX) XXX-XXXX if we have exactly 10 digits
        if (strlen($phone) == 10) {
            return '(' . substr($phone, 0, 3) . ') ' . substr($phone, 3, 3) . '-' . substr($phone, 6, 4);
        }
        
        // Return original if not 10 digits
        return $phone;
    }
} 