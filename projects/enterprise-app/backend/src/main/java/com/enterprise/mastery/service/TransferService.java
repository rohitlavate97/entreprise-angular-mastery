package com.enterprise.mastery.service;

import com.enterprise.mastery.domain.entity.Transfer;
import com.enterprise.mastery.domain.repository.TransferRepository;
import com.enterprise.mastery.dto.TransferRequest;
import com.enterprise.mastery.dto.TransferResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TransferService {

    private final TransferRepository transferRepository;

    @Transactional
    public TransferResponse executeTransfer(TransferRequest request, String idempotencyKey) {
        // -------------------------------------------------------------
        // Backend Idempotency Deduplication Guard
        // -------------------------------------------------------------
        if (StringUtils.hasText(idempotencyKey)) {
            Optional<Transfer> existingTransfer = transferRepository.findByIdempotencyKey(idempotencyKey);
            if (existingTransfer.isPresent()) {
                log.info("Idempotency match detected for key '{}'. Returning existing transaction reference '{}'",
                        idempotencyKey, existingTransfer.get().getReferenceId());
                return mapToResponse(existingTransfer.get());
            }
        }

        String referenceId = "TX-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

        Transfer transfer = Transfer.builder()
                .referenceId(referenceId)
                .sourceAccount(request.getSourceAccount())
                .targetAccount(request.getTargetAccount())
                .amount(request.getAmount())
                .currency(request.getCurrency())
                .description(request.getDescription())
                .status("COMPLETED")
                .idempotencyKey(idempotencyKey)
                .build();

        Transfer saved = transferRepository.save(transfer);
        log.info("Successfully executed transfer reference '{}' for amount {} {}",
                saved.getReferenceId(), saved.getAmount(), saved.getCurrency());

        return mapToResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<TransferResponse> getAllTransfers() {
        return transferRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt"))
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    private TransferResponse mapToResponse(Transfer transfer) {
        return TransferResponse.builder()
                .id(transfer.getId())
                .referenceId(transfer.getReferenceId())
                .sourceAccount(transfer.getSourceAccount())
                .targetAccount(transfer.getTargetAccount())
                .amount(transfer.getAmount())
                .currency(transfer.getCurrency())
                .status(transfer.getStatus())
                .description(transfer.getDescription())
                .idempotencyKey(transfer.getIdempotencyKey())
                .createdAt(transfer.getCreatedAt())
                .build();
    }
}
