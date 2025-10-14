"""
Context Enrichment System
Mission: Provide Rich Context for Review Decisions
Author: Claude Code
"""

from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from collections import defaultdict, Counter
import numpy as np
import json
import logging
import hashlib
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer

# Import from our modules
from review_task_manager import ReviewTask, TaskType
from task_persistence import TaskPersistence
from semantic_context_analyzer import BusinessDomain, RiskCategory

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class HistoricalContext:
    """Historical decision context"""
    decision_id: str
    timestamp: datetime
    outcome: str
    reviewer: str
    domain: str
    similarity_score: float
    key_factors: List[str]
    lessons_learned: Optional[str] = None


@dataclass
class SimilarCase:
    """Similar case information"""
    case_id: str
    similarity_score: float
    domain: str
    outcome: str
    decision_rationale: str
    risk_factors: List[str]
    mitigation_applied: Optional[str] = None
    effectiveness: Optional[float] = None


@dataclass
class RegulatoryRequirement:
    """Regulatory requirement information"""
    regulation: str
    jurisdiction: str
    requirement: str
    compliance_status: str
    documentation_needed: List[str]
    deadline: Optional[datetime] = None
    penalties: Optional[str] = None


@dataclass
class RiskIndicator:
    """Risk indicator with explanation"""
    indicator_name: str
    risk_level: str  # low, medium, high, critical
    score: float
    explanation: str
    contributing_factors: List[str]
    recommended_actions: List[str]


@dataclass
class EnrichedContext:
    """Complete enriched context for review"""
    task_id: str
    historical_context: List[HistoricalContext]
    similar_cases: List[SimilarCase]
    regulatory_requirements: List[RegulatoryRequirement]
    risk_indicators: List[RiskIndicator]
    explanation: str
    confidence_score: float
    key_insights: List[str]
    recommended_actions: List[str]


class ContextEnrichment:
    """System for enriching review context with relevant information"""
    
    def __init__(self, persistence: Optional[TaskPersistence] = None):
        self.persistence = persistence or TaskPersistence()
        self.case_database = self._initialize_case_database()
        self.regulatory_database = self._initialize_regulatory_database()
        self.risk_patterns = self._initialize_risk_patterns()
        self.vectorizer = TfidfVectorizer(max_features=100)
        self.case_vectors = None
        self._prepare_similarity_search()
        
    def _initialize_case_database(self) -> List[Dict[str, Any]]:
        """Initialize database of historical cases"""
        # In production, this would connect to a real case database
        return [
            {
                'case_id': 'CASE_HC_001',
                'domain': BusinessDomain.HEALTHCARE.value,
                'description': 'Emergency triage system showed bias against elderly patients',
                'outcome': 'rejected',
                'decision_rationale': 'Age-based discrimination detected in urgency scoring',
                'risk_factors': ['demographic_bias', 'healthcare_disparity', 'age_discrimination'],
                'mitigation_applied': 'Implemented age-neutral urgency scoring',
                'effectiveness': 0.85,
                'timestamp': datetime.now() - timedelta(days=30)
            },
            {
                'case_id': 'CASE_FIN_001',
                'domain': BusinessDomain.FINANCE.value,
                'description': 'Loan approval algorithm showed racial bias in credit decisions',
                'outcome': 'rejected',
                'decision_rationale': 'Disparate impact on minority applicants detected',
                'risk_factors': ['racial_bias', 'credit_discrimination', 'regulatory_violation'],
                'mitigation_applied': 'Removed proxy variables and retrained model',
                'effectiveness': 0.92,
                'timestamp': datetime.now() - timedelta(days=45)
            },
            {
                'case_id': 'CASE_EMP_001',
                'domain': BusinessDomain.EMPLOYMENT.value,
                'description': 'Resume screening system filtered candidates based on names',
                'outcome': 'rejected',
                'decision_rationale': 'Name-based discrimination violates EEOC guidelines',
                'risk_factors': ['name_bias', 'hiring_discrimination', 'EEOC_violation'],
                'mitigation_applied': 'Implemented blind resume review process',
                'effectiveness': 0.88,
                'timestamp': datetime.now() - timedelta(days=60)
            },
            {
                'case_id': 'CASE_HC_002',
                'domain': BusinessDomain.HEALTHCARE.value,
                'description': 'Clinical decision support system with transparent explanations',
                'outcome': 'approved',
                'decision_rationale': 'System provides clear medical justification for recommendations',
                'risk_factors': ['complexity', 'interpretability'],
                'mitigation_applied': None,
                'effectiveness': 0.95,
                'timestamp': datetime.now() - timedelta(days=15)
            },
            {
                'case_id': 'CASE_FIN_002',
                'domain': BusinessDomain.FINANCE.value,
                'description': 'Fraud detection system with balanced false positive rates',
                'outcome': 'approved',
                'decision_rationale': 'Equal false positive rates across demographic groups',
                'risk_factors': ['false_positives', 'customer_impact'],
                'mitigation_applied': 'Threshold calibration per group',
                'effectiveness': 0.90,
                'timestamp': datetime.now() - timedelta(days=20)
            }
        ]
    
    def _initialize_regulatory_database(self) -> Dict[str, List[RegulatoryRequirement]]:
        """Initialize regulatory requirements database"""
        return {
            BusinessDomain.HEALTHCARE.value: [
                RegulatoryRequirement(
                    regulation="HIPAA",
                    jurisdiction="United States",
                    requirement="Protect patient health information privacy",
                    compliance_status="mandatory",
                    documentation_needed=["Privacy policy", "Access logs", "Encryption certificates"],
                    penalties="Up to $50,000 per violation"
                ),
                RegulatoryRequirement(
                    regulation="FDA Medical Device",
                    jurisdiction="United States",
                    requirement="Clinical validation for AI/ML medical devices",
                    compliance_status="mandatory",
                    documentation_needed=["Clinical trials", "Validation studies", "510(k) submission"],
                    penalties="Product recall and fines"
                )
            ],
            BusinessDomain.FINANCE.value: [
                RegulatoryRequirement(
                    regulation="ECOA",
                    jurisdiction="United States",
                    requirement="Equal credit opportunity without discrimination",
                    compliance_status="mandatory",
                    documentation_needed=["Fair lending analysis", "Disparate impact assessment"],
                    penalties="Up to $500,000 per violation"
                ),
                RegulatoryRequirement(
                    regulation="GDPR",
                    jurisdiction="European Union",
                    requirement="Right to explanation for automated decisions",
                    compliance_status="mandatory",
                    documentation_needed=["Decision logic documentation", "Data processing records"],
                    penalties="Up to 4% of annual global turnover"
                )
            ],
            BusinessDomain.EMPLOYMENT.value: [
                RegulatoryRequirement(
                    regulation="Title VII",
                    jurisdiction="United States",
                    requirement="Prohibit employment discrimination",
                    compliance_status="mandatory",
                    documentation_needed=["EEO-1 reports", "Adverse impact analysis"],
                    penalties="Compensatory and punitive damages"
                ),
                RegulatoryRequirement(
                    regulation="ADA",
                    jurisdiction="United States",
                    requirement="Reasonable accommodations for disabilities",
                    compliance_status="mandatory",
                    documentation_needed=["Accommodation requests", "Interactive process records"],
                    penalties="Up to $75,000 first violation"
                )
            ]
        }
    
    def _initialize_risk_patterns(self) -> Dict[str, Dict[str, Any]]:
        """Initialize risk pattern detection rules"""
        return {
            'high_disparity': {
                'threshold': 0.2,
                'level': 'high',
                'explanation': 'Significant disparity detected between groups',
                'factors': ['demographic_parity', 'equalized_odds'],
                'actions': ['Review group outcomes', 'Implement fairness constraints']
            },
            'regulatory_violation': {
                'threshold': 0.8,
                'level': 'critical',
                'explanation': 'Potential regulatory compliance violation',
                'factors': ['protected_attribute_use', 'disparate_impact'],
                'actions': ['Legal review required', 'Immediate remediation needed']
            },
            'data_quality': {
                'threshold': 0.3,
                'level': 'medium',
                'explanation': 'Data quality issues may impact fairness',
                'factors': ['missing_data', 'imbalanced_classes'],
                'actions': ['Data audit recommended', 'Consider resampling techniques']
            },
            'model_drift': {
                'threshold': 0.15,
                'level': 'medium',
                'explanation': 'Model performance degradation detected',
                'factors': ['temporal_decay', 'distribution_shift'],
                'actions': ['Schedule retraining', 'Monitor performance metrics']
            },
            'interpretability': {
                'threshold': 0.6,
                'level': 'low',
                'explanation': 'Model decisions lack transparency',
                'factors': ['black_box_model', 'complex_features'],
                'actions': ['Add explanation module', 'Simplify decision logic']
            }
        }
    
    def _prepare_similarity_search(self):
        """Prepare vectors for similarity search"""
        if not self.case_database:
            return
        
        # Extract case descriptions
        descriptions = [case['description'] for case in self.case_database]
        
        # Fit vectorizer and transform descriptions
        if descriptions:
            self.case_vectors = self.vectorizer.fit_transform(descriptions)
    
    def enrich_context(self, task: ReviewTask) -> EnrichedContext:
        """Enrich task context with relevant information"""
        logger.info(f"Enriching context for task {task.task_id}")
        
        # Get historical context
        historical_context = self._get_historical_context(task)
        
        # Find similar cases
        similar_cases = self._find_similar_cases(task)
        
        # Get regulatory requirements
        regulatory_requirements = self._get_regulatory_requirements(task)
        
        # Analyze risk indicators
        risk_indicators = self._analyze_risk_indicators(task)
        
        # Generate explanation
        explanation = self._generate_explanation(task, historical_context, 
                                               similar_cases, risk_indicators)
        
        # Calculate confidence score
        confidence_score = self._calculate_confidence(historical_context, 
                                                     similar_cases, risk_indicators)
        
        # Extract key insights
        key_insights = self._extract_key_insights(task, historical_context, 
                                                 similar_cases, risk_indicators)
        
        # Generate recommended actions
        recommended_actions = self._generate_recommendations(task, risk_indicators, 
                                                            regulatory_requirements)
        
        return EnrichedContext(
            task_id=task.task_id,
            historical_context=historical_context,
            similar_cases=similar_cases,
            regulatory_requirements=regulatory_requirements,
            risk_indicators=risk_indicators,
            explanation=explanation,
            confidence_score=confidence_score,
            key_insights=key_insights,
            recommended_actions=recommended_actions
        )
    
    def _get_historical_context(self, task: ReviewTask) -> List[HistoricalContext]:
        """Retrieve relevant historical decisions"""
        historical = []
        
        # Get recent decisions from persistence
        try:
            audit_trail = self.persistence.get_audit_trail(
                start_date=datetime.now() - timedelta(days=90)
            )
            
            # Filter relevant entries
            for entry in audit_trail[:20]:  # Limit to recent 20
                if entry.get('action') == 'COMPLETE':
                    # Parse the audit entry
                    try:
                        new_state = json.loads(entry.get('new_state', '{}'))
                        if new_state.get('domain') == task.domain.value:
                            historical.append(HistoricalContext(
                                decision_id=new_state.get('decision_id', 'unknown'),
                                timestamp=datetime.fromisoformat(entry['timestamp']),
                                outcome=new_state.get('status', 'unknown'),
                                reviewer=entry.get('actor', 'system'),
                                domain=new_state.get('domain', 'unknown'),
                                similarity_score=0.7,  # Simplified scoring
                                key_factors=['domain_match', 'recent_decision'],
                                lessons_learned="Consider precedent from this case"
                            ))
                    except:
                        continue
                        
        except Exception as e:
            logger.error(f"Error retrieving historical context: {str(e)}")
        
        return historical[:5]  # Return top 5 most relevant
    
    def _find_similar_cases(self, task: ReviewTask) -> List[SimilarCase]:
        """Find similar historical cases"""
        similar = []
        
        # Create task description for similarity search
        task_description = f"{task.domain.value} {task.task_type.value} "
        task_description += ' '.join(task.triggers_activated)
        task_description += ' '.join([r.value for r in task.risk_categories])
        
        try:
            # Vectorize task description
            task_vector = self.vectorizer.transform([task_description])
            
            # Calculate similarities
            if self.case_vectors is not None:
                similarities = cosine_similarity(task_vector, self.case_vectors)[0]
                
                # Get top similar cases
                top_indices = np.argsort(similarities)[::-1][:5]
                
                for idx in top_indices:
                    if similarities[idx] > 0.3:  # Similarity threshold
                        case = self.case_database[idx]
                        similar.append(SimilarCase(
                            case_id=case['case_id'],
                            similarity_score=float(similarities[idx]),
                            domain=case['domain'],
                            outcome=case['outcome'],
                            decision_rationale=case['decision_rationale'],
                            risk_factors=case['risk_factors'],
                            mitigation_applied=case.get('mitigation_applied'),
                            effectiveness=case.get('effectiveness')
                        ))
        except Exception as e:
            logger.error(f"Error finding similar cases: {str(e)}")
        
        return similar
    
    def _get_regulatory_requirements(self, task: ReviewTask) -> List[RegulatoryRequirement]:
        """Get applicable regulatory requirements"""
        requirements = []
        
        # Get domain-specific requirements
        domain_reqs = self.regulatory_database.get(task.domain.value, [])
        
        # Filter based on task context
        for req in domain_reqs:
            # Check if requirement is relevant
            relevant = False
            
            # Check compliance requirements in context
            if task.context_data.get('compliance_requirements'):
                if req.regulation in task.context_data['compliance_requirements']:
                    relevant = True
            
            # Check based on risk categories
            if RiskCategory.REGULATORY_COMPLIANCE in task.risk_categories:
                relevant = True
            
            # Check based on domain
            if task.domain.value in [BusinessDomain.HEALTHCARE.value, 
                                    BusinessDomain.FINANCE.value,
                                    BusinessDomain.EMPLOYMENT.value]:
                relevant = True
            
            if relevant:
                requirements.append(req)
        
        return requirements
    
    def _analyze_risk_indicators(self, task: ReviewTask) -> List[RiskIndicator]:
        """Analyze and score risk indicators"""
        indicators = []
        
        # Check each risk pattern
        for pattern_name, pattern_config in self.risk_patterns.items():
            score = 0.0
            contributing_factors = []
            
            # Calculate risk score based on task attributes
            if pattern_name == 'high_disparity':
                if 'BiasScoreTrigger' in task.triggers_activated:
                    score = 0.8
                    contributing_factors.append('Bias trigger activated')
                if task.context_data.get('bias_score', 0) > 0.2:
                    score = max(score, task.context_data['bias_score'])
                    contributing_factors.append('High bias score')
                    
            elif pattern_name == 'regulatory_violation':
                if RiskCategory.REGULATORY_COMPLIANCE in task.risk_categories:
                    score = 0.7
                    contributing_factors.append('Regulatory compliance risk')
                if RiskCategory.LEGAL_LIABILITY in task.risk_categories:
                    score = max(score, 0.8)
                    contributing_factors.append('Legal liability risk')
                    
            elif pattern_name == 'data_quality':
                if 'SemanticAnomalyTrigger' in task.triggers_activated:
                    score = 0.5
                    contributing_factors.append('Semantic anomaly detected')
                    
            elif pattern_name == 'model_drift':
                if 'TemporalDecayTrigger' in task.triggers_activated:
                    score = 0.6
                    contributing_factors.append('Temporal decay detected')
                    
            elif pattern_name == 'interpretability':
                if task.context_data.get('confidence_score', 1.0) < 0.5:
                    score = 0.7
                    contributing_factors.append('Low confidence score')
            
            # Create indicator if score exceeds threshold
            if score > pattern_config['threshold']:
                indicators.append(RiskIndicator(
                    indicator_name=pattern_name,
                    risk_level=pattern_config['level'],
                    score=score,
                    explanation=pattern_config['explanation'],
                    contributing_factors=contributing_factors,
                    recommended_actions=pattern_config['actions']
                ))
        
        # Sort by score
        indicators.sort(key=lambda x: x.score, reverse=True)
        
        return indicators
    
    def _generate_explanation(self, task: ReviewTask, 
                            historical: List[HistoricalContext],
                            similar: List[SimilarCase],
                            risks: List[RiskIndicator]) -> str:
        """Generate human-readable explanation"""
        explanation_parts = []
        
        # Start with task overview
        explanation_parts.append(
            f"This {task.task_type.value} task in the {task.domain.value} domain "
            f"was triggered by {len(task.triggers_activated)} oversight mechanisms."
        )
        
        # Add risk summary
        if risks:
            high_risks = [r for r in risks if r.risk_level in ['high', 'critical']]
            if high_risks:
                explanation_parts.append(
                    f"Critical risks identified: {', '.join([r.indicator_name for r in high_risks])}."
                )
        
        # Add similar case insights
        if similar:
            top_similar = similar[0]
            explanation_parts.append(
                f"A similar case ({top_similar.case_id}) with {top_similar.similarity_score:.0%} "
                f"similarity was {top_similar.outcome} due to: {top_similar.decision_rationale}."
            )
            if top_similar.mitigation_applied:
                explanation_parts.append(
                    f"Mitigation applied: {top_similar.mitigation_applied} "
                    f"(effectiveness: {top_similar.effectiveness:.0%})."
                )
        
        # Add historical context
        if historical:
            recent_outcomes = Counter(h.outcome for h in historical)
            most_common = recent_outcomes.most_common(1)[0]
            explanation_parts.append(
                f"Historical precedent shows {most_common[1]} similar decisions "
                f"were {most_common[0]}."
            )
        
        # Add recommendations
        if risks and risks[0].recommended_actions:
            explanation_parts.append(
                f"Recommended actions: {', '.join(risks[0].recommended_actions[:2])}."
            )
        
        return ' '.join(explanation_parts)
    
    def _calculate_confidence(self, historical: List[HistoricalContext],
                            similar: List[SimilarCase],
                            risks: List[RiskIndicator]) -> float:
        """Calculate confidence score for the enriched context"""
        confidence = 0.5  # Base confidence
        
        # Increase confidence based on historical data
        if historical:
            confidence += min(len(historical) * 0.05, 0.2)
        
        # Increase confidence based on similar cases
        if similar:
            # Weight by similarity scores
            similarity_boost = sum(c.similarity_score for c in similar[:3]) / 3
            confidence += similarity_boost * 0.2
        
        # Adjust based on risk clarity
        if risks:
            # Clear risks increase confidence in assessment
            if any(r.risk_level == 'critical' for r in risks):
                confidence += 0.1
            elif any(r.risk_level == 'high' for r in risks):
                confidence += 0.05
        
        return min(confidence, 0.95)  # Cap at 95%
    
    def _extract_key_insights(self, task: ReviewTask,
                             historical: List[HistoricalContext],
                             similar: List[SimilarCase],
                             risks: List[RiskIndicator]) -> List[str]:
        """Extract key insights from enriched context"""
        insights = []
        
        # Risk-based insights
        if risks:
            critical_risks = [r for r in risks if r.risk_level == 'critical']
            if critical_risks:
                insights.append(f"⚠️ Critical risk: {critical_risks[0].explanation}")
        
        # Similar case insights
        if similar and similar[0].similarity_score > 0.7:
            insights.append(
                f"📊 Highly similar to {similar[0].case_id} "
                f"({similar[0].outcome} - {similar[0].similarity_score:.0%} match)"
            )
        
        # Pattern insights
        if len([r for r in risks if r.risk_level in ['high', 'critical']]) >= 2:
            insights.append("🔍 Multiple high-risk indicators detected")
        
        # Regulatory insights
        if RiskCategory.REGULATORY_COMPLIANCE in task.risk_categories:
            insights.append("📋 Regulatory compliance review required")
        
        # Domain-specific insights
        if task.domain == BusinessDomain.HEALTHCARE:
            if any('emergency' in t.lower() for t in task.triggers_activated):
                insights.append("🏥 Emergency medical decision - expedited review needed")
        elif task.domain == BusinessDomain.FINANCE:
            if task.context_data.get('amount', 0) > 100000:
                insights.append("💰 High-value transaction requires additional scrutiny")
        
        return insights[:5]  # Limit to top 5 insights
    
    def _generate_recommendations(self, task: ReviewTask,
                                 risks: List[RiskIndicator],
                                 requirements: List[RegulatoryRequirement]) -> List[str]:
        """Generate specific recommendations"""
        recommendations = []
        
        # Risk-based recommendations
        for risk in risks[:3]:  # Top 3 risks
            recommendations.extend(risk.recommended_actions[:2])
        
        # Regulatory recommendations
        for req in requirements[:2]:  # Top 2 requirements
            if req.documentation_needed:
                recommendations.append(f"Ensure {req.regulation} compliance: {req.documentation_needed[0]}")
        
        # Task-specific recommendations
        if task.sla_breached:
            recommendations.append("Priority review - SLA already breached")
        
        if task.escalation_count > 0:
            recommendations.append("Previously escalated - requires senior review")
        
        # Remove duplicates while preserving order
        seen = set()
        unique_recommendations = []
        for rec in recommendations:
            if rec not in seen:
                seen.add(rec)
                unique_recommendations.append(rec)
        
        return unique_recommendations[:5]  # Limit to top 5


# Example usage and testing
if __name__ == "__main__":
    from trigger_orchestrator import RoutingPriority
    from review_task_manager import SLALevel
    
    # Initialize enrichment system
    enrichment = ContextEnrichment()
    
    print("CONTEXT ENRICHMENT - TEST")
    print("=" * 60)
    
    # Create test task
    test_task = ReviewTask(
        task_id="ENRICH_TEST_001",
        task_type=TaskType.BIAS_REVIEW,
        status=None,
        priority=RoutingPriority.HIGH,
        sla_level=SLALevel.HIGH,
        created_at=datetime.now(),
        due_at=datetime.now() + timedelta(hours=4),
        decision_id="DEC_001",
        domain=BusinessDomain.HEALTHCARE,
        risk_categories=[RiskCategory.DISCRIMINATION_RISK, RiskCategory.REGULATORY_COMPLIANCE],
        triggers_activated=["BiasScoreTrigger", "ConfidenceBasedTrigger"],
        context_data={
            'bias_score': 0.3,
            'confidence_score': 0.4,
            'compliance_requirements': ['HIPAA'],
            'urgency': 'high'
        }
    )
    
    print("\n1. Enriching context for healthcare bias review task...")
    enriched = enrichment.enrich_context(test_task)
    
    print(f"\n2. Historical Context Found: {len(enriched.historical_context)}")
    for hist in enriched.historical_context[:2]:
        print(f"   - {hist.decision_id}: {hist.outcome} ({hist.similarity_score:.2f} similarity)")
    
    print(f"\n3. Similar Cases: {len(enriched.similar_cases)}")
    for case in enriched.similar_cases[:2]:
        print(f"   - {case.case_id}: {case.outcome} ({case.similarity_score:.2%} match)")
        print(f"     Rationale: {case.decision_rationale}")
    
    print(f"\n4. Regulatory Requirements: {len(enriched.regulatory_requirements)}")
    for req in enriched.regulatory_requirements:
        print(f"   - {req.regulation} ({req.jurisdiction}): {req.requirement}")
    
    print(f"\n5. Risk Indicators: {len(enriched.risk_indicators)}")
    for risk in enriched.risk_indicators:
        print(f"   - {risk.indicator_name} ({risk.risk_level}): {risk.score:.2f}")
        print(f"     {risk.explanation}")
    
    print(f"\n6. Generated Explanation:")
    print(f"   {enriched.explanation}")
    
    print(f"\n7. Confidence Score: {enriched.confidence_score:.2%}")
    
    print(f"\n8. Key Insights:")
    for insight in enriched.key_insights:
        print(f"   {insight}")
    
    print(f"\n9. Recommended Actions:")
    for action in enriched.recommended_actions:
        print(f"   - {action}")
    
    print("\n" + "=" * 60)
    print("TEST COMPLETE")